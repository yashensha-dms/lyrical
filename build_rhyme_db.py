import csv
import re
import sqlite3
import time
from collections import Counter
import pronouncing

def main():
    start_time = time.time()
    csv_path = r"D:\Projects\dataset\CLEANDATASET\unique_lines_clean.csv"
    db_path = "rhyme_data.db"
    
    print(f"Starting database build from: {csv_path}")
    
    word_counts = Counter()
    bigram_counts = Counter()
    
    # 1. Read CSV and count frequencies
    line_idx = 0
    with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row:
                continue
            line = row[0]
            line_idx += 1
            
            # Tokenize: extract words, convert to lowercase, strip single quotes
            raw_words = re.findall(r"[a-zA-Z']+", line.lower())
            words = []
            for rw in raw_words:
                cw = rw.strip("'")
                if cw:
                    words.append(cw)
            
            # Word frequencies
            word_counts.update(words)
            
            # Bigram frequencies
            bigrams = [f"{words[i]} {words[i+1]}" for i in range(len(words)-1)]
            bigram_counts.update(bigrams)
            
            if line_idx % 50000 == 0:
                print(f"Processed {line_idx} lines...")
                
    print(f"Finished reading {line_idx} lines. Found {len(word_counts)} unique words and {len(bigram_counts)} unique bigrams.")
    print(f"Time taken for reading and tokenizing: {time.time() - start_time:.2f} seconds.")
    
    # 2. Lookup words in pronouncing/CMU
    print("Looking up word phonemes...")
    phones_dict = {}
    lookup_start = time.time()
    for word in word_counts:
        phones_list = pronouncing.phones_for_word(word)
        if phones_list:
            phones_dict[word] = phones_list[0]
    print(f"Found CMU coverage for {len(phones_dict)} / {len(word_counts)} unique words in {time.time() - lookup_start:.2f} seconds.")
    
    # 3. Build DB lists
    print("Preparing database records...")
    words_to_insert = []
    for word, count in word_counts.items():
        if word in phones_dict:
            phonemes = phones_dict[word]
            rhyme_ending = pronouncing.rhyming_part(phonemes)
            if rhyme_ending:
                words_to_insert.append((word, phonemes, rhyme_ending, count))
                
    bigrams_to_insert = []
    for bigram, count in bigram_counts.items():
        parts = bigram.split(' ')
        if len(parts) == 2:
            w1, w2 = parts
            if w1 in phones_dict and w2 in phones_dict:
                combined_phonemes = f"{phones_dict[w1]} {phones_dict[w2]}"
                rhyme_ending = pronouncing.rhyming_part(combined_phonemes)
                if rhyme_ending:
                    bigrams_to_insert.append((bigram, combined_phonemes, rhyme_ending, count))
                    
    print(f"Prepared {len(words_to_insert)} words and {len(bigrams_to_insert)} bigrams for insertion.")
    
    # 4. Insert into SQLite
    print(f"Writing to SQLite database: {db_path}...")
    db_start = time.time()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Optimize SQLite settings for building
    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA journal_mode = MEMORY")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS words (
        word TEXT PRIMARY KEY,
        phonemes TEXT,
        rhyme_ending TEXT,
        frequency INTEGER
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bigrams (
        bigram TEXT PRIMARY KEY,
        phonemes TEXT,
        rhyme_ending TEXT,
        frequency INTEGER
    )
    """)
    
    # Insert batch data
    cursor.executemany("INSERT OR REPLACE INTO words (word, phonemes, rhyme_ending, frequency) VALUES (?, ?, ?, ?)", words_to_insert)
    cursor.executemany("INSERT OR REPLACE INTO bigrams (bigram, phonemes, rhyme_ending, frequency) VALUES (?, ?, ?, ?)", bigrams_to_insert)
    
    # Index both tables on rhyme_ending for fast lookup
    print("Creating indexes...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_words_rhyme_ending ON words(rhyme_ending)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bigrams_rhyme_ending ON bigrams(rhyme_ending)")
    
    conn.commit()
    conn.close()
    
    end_time = time.time()
    print("----- Database Build Final Stats -----")
    print(f"Total processing time: {end_time - start_time:.2f} seconds.")
    print(f"Words stored: {len(words_to_insert)}")
    print(f"Bigrams stored: {len(bigrams_to_insert)}")
    print("Database built successfully!")

if __name__ == "__main__":
    main()
