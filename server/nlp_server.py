import os
import re
import json
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import pronouncing

app = FastAPI(title="Songwriting Pop NLP Server")

# Allow CORS for direct queries
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables loaded on startup
semantic_similarity = {}
word_frequencies = {}
pop_bigrams = []
vocab_list = []
vocab_phones_cache = {}

STOP_WORDS = set([
    "the", "a", "an", "and", "or", "but", "if", "because", "as", "until", "while",
    "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once",
    "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "should", "now",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves"
])

@app.on_event("startup")
def startup_event():
    global semantic_similarity, word_frequencies, pop_bigrams, vocab_list, vocab_phones_cache
    server_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Load NPMI semantic similarity
    similarity_path = os.path.join(server_dir, "pop_semantic_similarity.json")
    if os.path.exists(similarity_path):
        print(f"Loading semantic similarity from {similarity_path}...")
        with open(similarity_path, 'r', encoding='utf-8') as f:
            semantic_similarity = json.load(f)
    else:
        print("Warning: Semantic similarity file not found. Run train_pop_models.py first.")

    # 2. Load Word Frequencies
    freq_path = os.path.join(server_dir, "word_frequencies.json")
    if os.path.exists(freq_path):
        print(f"Loading word frequencies from {freq_path}...")
        with open(freq_path, 'r', encoding='utf-8') as f:
            word_frequencies = json.load(f)
        vocab_list = list(word_frequencies.keys())
    else:
        print("Warning: Word frequencies file not found.")

    # 3. Load Bigrams
    bigrams_path = os.path.join(server_dir, "pop_bigrams.json")
    if os.path.exists(bigrams_path):
        print(f"Loading pop bigrams from {bigrams_path}...")
        with open(bigrams_path, 'r', encoding='utf-8') as f:
            pop_bigrams = json.load(f)
    else:
        print("Warning: Pop bigrams file not found.")

    # Cache vocabulary phonemes for real-time rhyming checks
    print("Pre-caching phonemes for vocabulary...")
    for word in vocab_list:
        phones = pronouncing.phones_for_word(word)
        if phones:
            vocab_phones_cache[word] = phones[0]
    print("Startup complete. NLP server ready.")


def clean_word(word):
    word = word.lower().strip()
    word = re.sub(r'^[^a-z]+|[^a-z]+$', '', word)
    return word

def edit_distance(s1, s2):
    if len(s1) > len(s2):
        s1, s2 = s2, s1
    distances = range(len(s1) + 1)
    for i2, c2 in enumerate(s2):
        distances_ = [i2+1]
        for i1, c1 in enumerate(s1):
            if c1 == c2:
                distances_.append(distances[i1])
            else:
                distances_.append(1 + min((distances[i1], distances[i1+1], distances_[-1])))
        distances = distances_
    return distances[-1]

def get_rhyme_parts(phones_str):
    """
    Splits phonemes into (stressed_vowel, rhyme_suffix, consonants_after_vowel)
    Example: 'L AH1 V' -> stressed_vowel='AH1', suffix=['AH1', 'V'], consonants=['V']
    """
    parts = phones_str.split()
    vowel_idx = -1
    for i in range(len(parts) - 1, -1, -1):
        if any(char.isdigit() for char in parts[i]):
            vowel_idx = i
            break
            
    if vowel_idx != -1:
        # Strip stress numbers (e.g. AH1 -> AH) to compare root vowel sound
        stressed_vowel = re.sub(r'\d', '', parts[vowel_idx])
        suffix = parts[vowel_idx:]
        consonants = parts[vowel_idx+1:]
        return stressed_vowel, suffix, consonants
    return None, parts, parts

def get_syllable_count(word):
    phones = pronouncing.phones_for_word(word)
    if phones:
        return pronouncing.syllable_count(phones[0])
    return max(1, len(re.findall(r'[aeiouy]+', word.lower())))


class ScanRequest(BaseModel):
    text: str

@app.get("/api/analyze-word")
def analyze_word(word: str = Query(..., description="The word to search rhymes and associations for")):
    clean_q = clean_word(word)
    if not clean_q:
        return {"word": word, "rhymes": [], "associations": []}

    # 1. Fetch phonemes of the query word
    q_phones = pronouncing.phones_for_word(clean_q)
    if not q_phones:
        # If CMU dict doesn't have it, fallback to default or semantic suggestions only
        print(f"Word '{clean_q}' not in CMUDict.")
        return {"word": clean_q, "rhymes": {"perfect": [], "slant": [], "vowel": []}, "associations": get_semantic_associations(clean_q)}

    q_stressed_vowel, q_suffix, q_consonants = get_rhyme_parts(q_phones[0])
    q_syl = pronouncing.syllable_count(q_phones[0])

    perfect_list = []
    slant_list = []
    vowel_list = []

    # 2. Score Single Vocabulary Words
    for candidate in vocab_list:
        if candidate == clean_q:
            continue
            
        c_phones_str = vocab_phones_cache.get(candidate)
        if not c_phones_str:
            continue
            
        c_stressed_vowel, c_suffix, c_consonants = get_rhyme_parts(c_phones_str)
        
        # Perfect Rhyme check (exact phoneme suffix match)
        if c_suffix == q_suffix:
            perfect_list.append((candidate, word_frequencies.get(candidate, 1), False))
            continue
            
        # Slant/Vowel Rhyme check (requires matching stressed vowel nucleus)
        if c_stressed_vowel and c_stressed_vowel == q_stressed_vowel:
            dist = edit_distance(q_consonants, c_consonants)
            if dist <= 1:
                # Soft/slant rhyme: Vowels match, consonants differ by 0 or 1 sound change
                slant_list.append((candidate, word_frequencies.get(candidate, 1), False))
            else:
                # Vowel rhyme: Vowels match but consonants differ significantly
                vowel_list.append((candidate, word_frequencies.get(candidate, 1), False))

    # 3. Score harvested bigrams (multi-word rhymes matching total syllables)
    for bigram in pop_bigrams:
        b_phrase = bigram["phrase"]
        b_syl = bigram["syllables"]
        
        # We target bigrams that match total syllables of query word
        if b_syl == q_syl:
            b_phones_str = bigram["phones"]
            b_stressed_vowel, b_suffix, b_consonants = get_rhyme_parts(b_phones_str)
            
            if b_suffix == q_suffix:
                perfect_list.append((b_phrase, bigram["count"], True))
            elif b_stressed_vowel and b_stressed_vowel == q_stressed_vowel:
                dist = edit_distance(q_consonants, b_consonants)
                if dist <= 1:
                    slant_list.append((b_phrase, bigram["count"], True))
                else:
                    vowel_list.append((b_phrase, bigram["count"], True))

    # 4. Score and sort lists by NPMI semantic similarity
    def process_and_rank_rhymes(rhyme_tuples):
        results = []
        for term, count, is_phrase in rhyme_tuples:
            sim_score = 0.0
            if is_phrase:
                words = term.split()
                scores = []
                for w in words:
                    # Look up NPMI score in our cached map
                    scores.append(semantic_similarity.get(clean_q, {}).get(w, 0.0))
                sim_score = sum(scores) / len(scores) if scores else 0.0
            else:
                sim_score = semantic_similarity.get(clean_q, {}).get(term, 0.0)
            
            results.append({
                "word": term,
                "count": count,
                "isPhrase": is_phrase,
                "similarity": sim_score
            })
        # Primary sort: semantic similarity (descending), secondary sort: corpus frequency (descending)
        return sorted(results, key=lambda x: (x["similarity"], x["count"]), reverse=True)[:30]

    return {
        "word": clean_q,
        "rhymes": {
            "perfect": process_and_rank_rhymes(perfect_list),
            "slant": process_and_rank_rhymes(slant_list),
            "vowel": process_and_rank_rhymes(vowel_list)
        },
        "associations": get_semantic_associations(clean_q)
    }

def get_semantic_associations(word: str) -> List[Dict[str, Any]]:
    # Look up direct NPMI values from our precomputed map
    similar_terms = semantic_similarity.get(word, {})
    if not similar_terms:
        return []
    
    # Sort terms by similarity score descending
    sorted_terms = sorted(similar_terms.items(), key=lambda x: x[1], reverse=True)
    
    results = []
    for term, score in sorted_terms:
        if term not in STOP_WORDS:
            results.append({
                "word": term,
                "count": word_frequencies.get(term, 1),
                "similarity": float(score)
            })
    return results[:30]


@app.post("/api/scan-simplicity")
def scan_simplicity(req: ScanRequest):
    text = req.text
    if not text:
        return {"matches": []}

    matches_in_text = re.finditer(r"\b[a-zA-Z']+\b", text)
    results = []
    word_cache = {}
    
    for match in matches_in_text:
        word = match.group(0)
        clean_w = clean_word(word)
        if not clean_w or clean_w in STOP_WORDS or len(clean_w) <= 2:
            continue
            
        index = match.start()
        
        # Check frequency of this word in our Billboard pop corpus
        freq = word_frequencies.get(clean_w, 0)
        
        # Emily Warren's anti-thesaurus rule: flag rare words (frequency < 15 occurrences)
        if freq < 15:
            if clean_w not in word_cache:
                suggestions = []
                similar_terms = semantic_similarity.get(clean_w, {})
                
                if similar_terms:
                    q_syl = get_syllable_count(clean_w)
                    # Sort semantic synonyms by NPMI score descending
                    sorted_syns = sorted(similar_terms.items(), key=lambda x: x[1], reverse=True)
                    
                    for term, score in sorted_syns:
                        term_freq = word_frequencies.get(term, 0)
                        term_syl = get_syllable_count(term)
                        
                        # Synonym must be:
                        # 1. Significantly more common in pop corpus (at least 1.5x query word, and min 30 count)
                        # 2. Syllable count is smaller or equal to original word
                        if term_freq >= max(30, freq * 1.5) and term_syl <= q_syl and term not in STOP_WORDS:
                            suggestions.append(term)
                
                word_cache[clean_w] = suggestions[:5]
                
            word_suggs = word_cache[clean_w]
            # Highlight if the word is rare (even if no synonyms are found, it should be flagged)
            results.append({
                "word": word,
                "index": index,
                "frequency": freq,
                "suggestions": word_suggs
            })
                
    return {"matches": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("nlp_server:app", host="127.0.0.1", port=5002, reload=False)
