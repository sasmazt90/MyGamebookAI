#!/usr/bin/env node
/**
 * Regenerate books with enhanced character uniqueness constraints.
 * 
 * This script:
 * 1. Finds all books with multiple characters
 * 2. Resets their generation status to 'queued'
 * 3. Creates new generation jobs
 * 4. Triggers the generation worker to regenerate with enhanced constraints
 * 
 * Usage:
 *   node -r tsx/cjs scripts/regenerate-books.mjs [bookIds...]
 *   # Regenerate specific books:
 *   node -r tsx/cjs scripts/regenerate-books.mjs 1 2 3
 *   # Regenerate all books with multiple characters:
 *   node -r tsx/cjs scripts/regenerate-books.mjs
 */

import { getDb } from '../server/db.ts';
import { books, bookCharacters, generationJobs } from '../drizzle/schema.ts';
import { eq, inArray } from 'drizzle-orm';
import { claimAndRunJob } from '../server/generationWorker.ts';
import { generateBookContent } from '../server/routers/books.ts';

async function regenerateBooks(bookIds) {
  const db = await getDb();
  if (!db) {
    console.error('Failed to connect to database');
    process.exit(1);
  }

  try {
    // If no book IDs provided, find all books with multiple characters
    let targetBooks;
    if (bookIds.length === 0) {
      console.log('Finding all books with multiple characters...');
      const allBooks = await db.select().from(books);
      
      const booksWithCharCounts = await Promise.all(
        allBooks.map(async (book) => {
          const chars = await db
            .select()
            .from(bookCharacters)
            .where(eq(bookCharacters.bookId, book.id));
          return { book, charCount: chars.length };
        })
      );

      targetBooks = booksWithCharCounts
        .filter(({ charCount }) => charCount > 1)
        .map(({ book }) => book);
    } else {
      // Use provided book IDs
      targetBooks = await db
        .select()
        .from(books)
        .where(inArray(books.id, bookIds.map(Number)));
    }

    if (targetBooks.length === 0) {
      console.log('No books found to regenerate.');
      process.exit(0);
    }

    console.log(`\nFound ${targetBooks.length} book(s) to regenerate:`);
    targetBooks.forEach((b) => {
      console.log(`  - ${b.title} (ID: ${b.id})`);
    });

    // Regenerate each book
    for (const book of targetBooks) {
      console.log(`\nRegenerating: ${book.title} (ID: ${book.id})`);

      // Fetch characters
      const chars = await db
        .select()
        .from(bookCharacters)
        .where(eq(bookCharacters.bookId, book.id));

      if (chars.length === 0) {
        console.log(`  ⚠️  No characters found, skipping.`);
        continue;
      }

      // Reset book status
      await db
        .update(books)
        .set({ status: 'generating', generationStep: 'Initializing regeneration...' })
        .where(eq(books.id, book.id));

      // Create new generation job
      const [jobRow] = await db
        .insert(generationJobs)
        .values({ bookId: book.id })
        .$returningId();
      const jobId = jobRow?.id;

      if (!jobId) {
        console.log(`  ❌ Failed to create generation job`);
        continue;
      }

      console.log(`  ✓ Created job ID: ${jobId}`);
      console.log(`  ✓ Characters: ${chars.map(c => c.name).join(', ')}`);

      // Trigger regeneration with enhanced constraints
      try {
        await claimAndRunJob(
          jobId,
          book.id,
          {
            title: book.title,
            category: book.category,
            length: book.length,
            description: book.description ?? '',
            language: book.bookLanguage,
            characters: chars.map(c => ({ name: c.name, photoUrl: c.photoUrl ?? undefined })),
          },
          db,
          async (bookId, data) => {
            // This callback is invoked after generateBookContent completes
            const updatedBook = await db
              .select()
              .from(books)
              .where(eq(books.id, bookId))
              .limit(1);
            const status = updatedBook[0]?.status;
            console.log(`  ✓ Regeneration completed with status: ${status}`);
          }
        );
        console.log(`  ✓ Generation job started`);
      } catch (error) {
        console.error(`  ❌ Error during regeneration:`, error);
      }
    }

    console.log('\n✅ Regeneration initiated for all books.');
    console.log('Monitor progress in the Library page or check generation job status.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Parse command-line arguments
const args = process.argv.slice(2);
await regenerateBooks(args);
