import pandas as pd
import re
import json
import os
import math
import pronouncing

# Stop words to exclude from simplicity checker scan and vocabulary
STOP_WORDS = set([
    "the", "a", "an", "and", "or", "but", "if", "because", "as", "until", "while",
    "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once",
    "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "should", "now",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves"
])

def clean_word(word):
    word = word.lower().strip()
    word = re.sub(r'^[^a-z]+|[^a-z]+$', '', word)
    return word

def main():
    csv_file = "d:\\Projects\\dataset\\lyrics_dataset.csv"
    if not os.path.exists(csv_file):
        print(f"Error: Lyrics dataset not found at {csv_file}")
        return

    print("Reading lyrics dataset...")
    df = pd.read_csv(csv_file)
    
    # Ensure we only extract from the 'lyrics' column
    lyrics_list = df['lyrics'].dropna().astype(str).tolist()
    print(f"Loaded {len(lyrics_list)} songs.")

    print("Step 1: Parsing stanzas and counting word frequencies...")
    # Track word frequencies
    word_counts = {}
    # Track word occurrences in stanzas for co-occurrence statistics
    stanza_word_counts = {}
    # Track joint co-occurrences of words in the same stanza
    joint_counts = {}
    # Track bigrams for multi-word rhyming
    bigram_counts = {}
    
    stanzas_count = 0

    for idx, lyrics in enumerate(lyrics_list):
        if (idx + 1) % 2000 == 0:
            print(f"Processing song {idx+1}/{len(lyrics_list)}...")
            
        # Split into stanzas
        song_stanzas = [s.strip() for s in lyrics.split('\n\n') if s.strip()]
        if not song_stanzas:
            song_stanzas = [lyrics]
            
        for stanza in song_stanzas:
            stanzas_count += 1
            lines = [line.strip() for line in stanza.split('\n') if line.strip()]
            
            # Words in this stanza (excluding stop words for main calculations)
            stanza_words = set()
            
            for line in lines:
                words = re.findall(r'\b[a-zA-Z]+\b', line)
                clean_words = []
                for w in words:
                    cw = clean_word(w)
                    if cw:
                        clean_words.append(cw)
                        if cw not in STOP_WORDS:
                            word_counts[cw] = word_counts.get(cw, 0) + 1
                            stanza_words.add(cw)
                
                # Count bigrams within lines (can include stop words as long as both are not stop words)
                if len(clean_words) > 1:
                    for i in range(len(clean_words) - 1):
                        bigram = f"{clean_words[i]} {clean_words[i+1]}"
                        bigram_counts[bigram] = bigram_counts.get(bigram, 0) + 1
            
            # Update stanza presence counts
            for w in stanza_words:
                stanza_word_counts[w] = stanza_word_counts.get(w, 0) + 1
                
            # Update joint presence counts (stanza-level co-occurrences)
            stanza_words_list = list(stanza_words)
            for i, w1 in enumerate(stanza_words_list):
                for w2 in stanza_words_list[i+1:]:
                    pair = tuple(sorted([w1, w2]))
                    joint_counts[pair] = joint_counts.get(pair, 0) + 1

    print(f"Total stanzas parsed: {stanzas_count}")

    print("Step 2: Selecting vocabulary...")
    # Sort and keep top 12,000 words (which are now free of stop words)
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    vocab = {w for w, count in sorted_words[:12000]}
    
    server_dir = "d:\\Projects\\Songwriting\\server"
    os.makedirs(server_dir, exist_ok=True)
    
    # Save word frequency rankings
    frequencies = {w: count for w, count in sorted_words[:15000]}
    freq_path = os.path.join(server_dir, "word_frequencies.json")
    with open(freq_path, 'w', encoding='utf-8') as f:
        json.dump(frequencies, f, indent=2)
    print(f"Word frequencies saved to: {freq_path}")

    print("Step 3: Calculating NPMI Semantic Similarity...")
    semantic_similarity = {}
    for word in vocab:
        semantic_similarity[word] = {}

    print(f"Calculating co-occurrences for {len(vocab)} words...")
    for (w1, w2), joint in joint_counts.items():
        if joint >= 3:  # Only count pairs that co-occur in at least 3 stanzas
            if w1 in vocab and w2 in vocab:
                c1 = stanza_word_counts.get(w1, 0)
                c2 = stanza_word_counts.get(w2, 0)
                if c1 > 0 and c2 > 0:
                    p_xy = joint / stanzas_count
                    p_x = c1 / stanzas_count
                    p_y = c2 / stanzas_count
                    
                    pmi = math.log2(p_xy / (p_x * p_y))
                    npmi = pmi / (-math.log2(p_xy))
                    
                    # Lower NPMI threshold to 0.01 for a much richer, dense association matrix
                    if npmi > 0.01:
                        semantic_similarity[w1][w2] = round(npmi, 4)
                        semantic_similarity[w2][w1] = round(npmi, 4)

    # Prune and save only top 50 semantic associations per word to keep JSON small
    pruned_similarity = {}
    for word, associations in semantic_similarity.items():
        sorted_assoc = sorted(associations.items(), key=lambda x: x[1], reverse=True)[:50]
        pruned_similarity[word] = {item[0]: item[1] for item in sorted_assoc}

    similarity_path = os.path.join(server_dir, "pop_semantic_similarity.json")
    with open(similarity_path, 'w', encoding='utf-8') as f:
        json.dump(pruned_similarity, f, indent=2)
    print(f"Semantic similarity matrix saved to: {similarity_path}")

    print("Step 4: Compiling rhyming bigrams...")
    frequent_bigrams = []
    for bigram, count in bigram_counts.items():
        if count >= 4:
            parts = bigram.split()
            if not (parts[0] in STOP_WORDS and parts[1] in STOP_WORDS):
                p0_phones = pronouncing.phones_for_word(parts[0])
                p1_phones = pronouncing.phones_for_word(parts[1])
                if p0_phones and p1_phones:
                    syl_count = pronouncing.syllable_count(p0_phones[0]) + pronouncing.syllable_count(p1_phones[0])
                    combined_phones = f"{p0_phones[0]} {p1_phones[0]}"
                    frequent_bigrams.append({
                        "phrase": bigram,
                        "syllables": syl_count,
                        "phones": combined_phones,
                        "count": count
                    })

    frequent_bigrams = sorted(frequent_bigrams, key=lambda x: x['count'], reverse=True)[:8000]
    
    bigrams_path = os.path.join(server_dir, "pop_bigrams.json")
    with open(bigrams_path, 'w', encoding='utf-8') as f:
        json.dump(frequent_bigrams, f, indent=2)
    print(f"Pop rhyming bigrams saved to: {bigrams_path}")
    print("All models and lookup tables successfully compiled!")

if __name__ == "__main__":
    main()
