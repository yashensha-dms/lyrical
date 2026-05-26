import sqlite3
from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
import pronouncing
from pydantic import BaseModel
from typing import List

# Global DB connection, cached unique endings, SentenceTransformer model, and phoneme profiles
mem_conn = None
unique_word_endings = []
unique_bigram_endings = []
sentence_model = None
word_phoneme_profiles = []

# ── Phonetic & Phoneme Distance Logic ─────────────────────────────────────────

def clean_phoneme(p):
    # Remove stress numbers from vowels (e.g., 'AH1' -> 'AH')
    return ''.join(c for c in p if not c.isdigit())

VOWELS = {
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW', 'AX'
}

VOWEL_GROUPS = [
    {'AH', 'AX', 'EH', 'IH', 'UH'},          # Short/central
    {'AA', 'AO', 'ER', 'AE'},                # Open/back
    {'EY', 'IY', 'AY'},                      # Long front / glide diphthongs
    {'UW', 'OW', 'AW', 'OY'}                 # Long back / rounded
]

CONSONANT_GROUPS = [
    {'M', 'N', 'NG'},                        # Nasals
    {'S', 'Z', 'SH', 'ZH', 'F', 'V', 'TH', 'DH'}, # Fricatives / sibilants
    {'P', 'B', 'T', 'D', 'K', 'G'},          # Plosives
    {'L', 'R', 'W', 'Y', 'HH', 'CH', 'JH'}   # Glides / liquids / affricates
]

def get_phoneme_cost(p1, p2):
    if p1 == p2:
        return 0.0
    
    cp1 = clean_phoneme(p1)
    cp2 = clean_phoneme(p2)
    
    if cp1 == cp2:
        return 0.1 # Very minor difference (usually just stress difference)
        
    is_v1 = cp1 in VOWELS
    is_v2 = cp2 in VOWELS
    
    if is_v1 != is_v2:
        return 1.8 # Vowel vs Consonant: high cost
        
    if is_v1:
        # Both are vowels
        for group in VOWEL_GROUPS:
            if cp1 in group and cp2 in group:
                return 0.3 # Close vowel sound
        return 0.8 # Different vowel group
    else:
        # Both are consonants
        for group in CONSONANT_GROUPS:
            if cp1 in group and cp2 in group:
                return 0.4 # Similar consonant class
        return 0.9 # Different consonant class

def phoneme_distance(seq1, seq2):
    m, n = len(seq1), len(seq2)
    dp = [[0.0] * (n + 1) for _ in range(m + 1)]
    
    for i in range(m + 1):
        dp[i][0] = i * 1.0
    for j in range(n + 1):
        dp[0][j] = j * 1.0
        
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            p1 = seq1[i-1]
            p2 = seq2[j-1]
            cost = get_phoneme_cost(p1, p2)
            
            dp[i][j] = min(
                dp[i-1][j] + 1.0,      # Deletion
                dp[i][j-1] + 1.0,      # Insertion
                dp[i-1][j-1] + cost    # Substitution
            )
            
    return dp[m][n]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global mem_conn, unique_word_endings, unique_bigram_endings, sentence_model, word_phoneme_profiles
    print("Loading rhyme_data.db into memory...")
    disk_conn = sqlite3.connect("rhyme_data.db")
    mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
    disk_conn.backup(mem_conn)
    disk_conn.close()
    
    # Pre-cache unique endings for slant rhyme lookups
    cursor = mem_conn.cursor()
    cursor.execute("SELECT DISTINCT rhyme_ending FROM words")
    unique_word_endings = [r[0] for r in cursor.fetchall() if r[0]]
    
    cursor.execute("SELECT DISTINCT rhyme_ending FROM bigrams")
    unique_bigram_endings = [r[0] for r in cursor.fetchall() if r[0]]

    # Pre-cache word phoneme profiles for fast phonetic swapping
    print("Caching word phoneme profiles...")
    cursor.execute("SELECT word, phonemes, frequency FROM words")
    word_phoneme_profiles = []
    for w, ph, freq in cursor.fetchall():
        phones = ph.split()
        vowels = [clean_phoneme(p) for p in phones if clean_phoneme(p) in VOWELS]
        word_phoneme_profiles.append({
            "word": w,
            "phonemes": phones,
            "vowels": vowels,
            "syllables": len(vowels),
            "frequency": freq
        })
    print(f"Cached {len(word_phoneme_profiles)} word phoneme profiles.")
    
    # Load SentenceTransformer model
    try:
        from sentence_transformers import SentenceTransformer
        print("Loading SentenceTransformer model...")
        sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
        print("SentenceTransformer model loaded.")
    except Exception as e:
        print(f"Error loading SentenceTransformer model: {e}")
        sentence_model = None
        
    print("Rhyme service startup complete.")
    yield
    if mem_conn:
        mem_conn.close()

app = FastAPI(lifespan=lifespan)

@app.get("/rhyme")
def get_rhyme(word: str = Query(..., description="Query word to find rhymes for")):
    word_clean = word.lower().strip()
    
    phones_list = pronouncing.phones_for_word(word_clean)
    if not phones_list:
        return {
            "word": word,
            "perfect": [],
            "slant": [],
            "perfect_bigrams": [],
            "slant_bigrams": []
        }
        
    phonemes = phones_list[0]
    rhyme_ending = pronouncing.rhyming_part(phonemes)
    if not rhyme_ending:
        return {
            "word": word,
            "perfect": [],
            "slant": [],
            "perfect_bigrams": [],
            "slant_bigrams": []
        }
        
    cursor = mem_conn.cursor()
    
    # 2. Perfect word rhymes
    cursor.execute(
        "SELECT word FROM words WHERE rhyme_ending = ? AND word != ? ORDER BY frequency DESC LIMIT 30",
        (rhyme_ending, word_clean)
    )
    perfect_words = [r[0] for r in cursor.fetchall()]
    
    # 3. Slant word rhymes
    STOPWORDS = {
        "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", 
        "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", 
        "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", 
        "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", 
        "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", 
        "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", 
        "for", "with", "about", "against", "between", "into", "through", "during", "before", 
        "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", 
        "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", 
        "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", 
        "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", 
        "will", "just", "don", "should", "now", "d", "ll", "m", "o", "re", "ve", "y", "ain", 
        "aren", "couldn", "didn", "doesn", "hadn", "hasn", "haven", "isn", "ma", "mightn", 
        "mustn", "needn", "shan", "shouldn", "wasn", "weren", "won", "wouldn",
        "i'm", "you're", "he's", "she's", "it's", "we're", "they're", "i've", "you've", "we've", 
        "they've", "i'd", "you'd", "he'd", "she'd", "we'd", "they'd", "i'll", "you'll", "he'll", 
        "she'll", "we'll", "they'll", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", 
        "hadn't", "doesn't", "don't", "didn't", "won't", "wouldn't", "shan't", "shouldn't", "can't", 
        "cannot", "couldn't", "mustn't", "let's", "that's", "who's", "what's", "here's", "there's", 
        "when's", "where's", "why's", "how's", "a's", "y'all", "got", "get", "like", "tell", "come", 
        "go", "make", "take", "would", "could", "should"
    }
    
    # Calculate slant word endings using phonetic token edit distance
    source_tokens = rhyme_ending.split()
    slant_w_endings = [e for e in unique_word_endings if phoneme_distance(source_tokens, e.split()) < 1.3]
    
    if not slant_w_endings:
        slant_words = []
    else:
        placeholders = ",".join("?" for _ in slant_w_endings)
        query_params = slant_w_endings + [word_clean]
        cursor.execute(
            f"SELECT word FROM words WHERE rhyme_ending IN ({placeholders}) AND word != ? ORDER BY frequency DESC LIMIT 200",
            query_params
        )
        raw_slant_words = [r[0] for r in cursor.fetchall()]
        slant_words = [w for w in raw_slant_words if len(w) >= 3 and w not in STOPWORDS][:30]
        
    # 4. Perfect bigram rhymes
    cursor.execute(
        "SELECT bigram FROM bigrams WHERE rhyme_ending = ? ORDER BY frequency DESC LIMIT 150",
        (rhyme_ending,)
    )
    raw_perfect_bigrams = [r[0] for r in cursor.fetchall()]
    perfect_bigrams = []
    for bg in raw_perfect_bigrams:
        parts = bg.split()
        if word_clean not in parts:
            perfect_bigrams.append(bg)
        if len(perfect_bigrams) >= 30:
            break
    
    # 5. Slant bigram rhymes
    slant_b_endings = [e for e in unique_bigram_endings if phoneme_distance(source_tokens, e.split()) < 1.3]
    if not slant_b_endings:
        slant_bigrams = []
    else:
        placeholders = ",".join("?" for _ in slant_b_endings)
        cursor.execute(
            f"SELECT bigram FROM bigrams WHERE rhyme_ending IN ({placeholders}) ORDER BY frequency DESC LIMIT 2000",
            slant_b_endings
        )
        raw_slant_bigrams = [r[0] for r in cursor.fetchall()]
        slant_bigrams = []
        for bg in raw_slant_bigrams:
            parts = bg.split()
            if len(parts) == 2:
                if word_clean in parts:
                    continue
                if len(parts[0]) >= 3 and parts[0] not in STOPWORDS and len(parts[1]) >= 3 and parts[1] not in STOPWORDS:
                    slant_bigrams.append(bg)
            if len(slant_bigrams) >= 30:
                break
        
    return {
        "word": word,
        "perfect": perfect_words,
        "slant": slant_words,
        "perfect_bigrams": perfect_bigrams,
        "slant_bigrams": slant_bigrams
    }

# ── Semantic Search / Sentence Similarity Endpoint ────────────────────────────

class SemanticSearchRequest(BaseModel):
    query: str
    documents: List[str]

@app.post("/semantic-search")
def semantic_search(req: SemanticSearchRequest):
    if not sentence_model or not req.documents:
        return {"query": req.query, "results": []}
        
    query_emb = sentence_model.encode(req.query, convert_to_tensor=True)
    doc_embs = sentence_model.encode(req.documents, convert_to_tensor=True)
    
    # Compute cosine similarities using sentence-transformers util
    from sentence_transformers import util
    cos_scores = util.cos_sim(query_emb, doc_embs)[0]
    
    # Prepare results sorted by score descending
    scored = []
    for doc, score in zip(req.documents, cos_scores.tolist()):
        scored.append({"document": doc, "score": score})
        
    scored.sort(key=lambda x: x["score"], reverse=True)
    return {"query": req.query, "results": scored}

# ── Rhyme Density & Phonetic Swap Engines ──────────────────────────────────────

import re
import math

CMU_PHONEMES = {
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW', 'AX',
    'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH'
}

GIBBERISH_VOWELS = {
    'a': 'AE', 'e': 'EH', 'i': 'IH', 'o': 'AA', 'u': 'AH', 'y': 'IY',
    'aa': 'AA', 'ae': 'AE', 'ai': 'AY', 'ao': 'AO', 'au': 'AW', 'aw': 'AW',
    'ay': 'AY', 'ee': 'IY', 'ei': 'EY', 'ey': 'EY', 'ie': 'IY', 'oa': 'OW',
    'oe': 'OW', 'oi': 'OY', 'oo': 'UW', 'ou': 'OW', 'ow': 'AW', 'oy': 'OY',
    'ue': 'UW', 'ui': 'UW', 'uy': 'AY'
}
GIBBERISH_CONSONANTS = {
    'b': 'B', 'c': 'K', 'd': 'D', 'f': 'F', 'g': 'G', 'h': 'HH',
    'j': 'JH', 'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'p': 'P',
    'q': 'K', 'r': 'R', 's': 'S', 't': 'T', 'v': 'V', 'w': 'W',
    'x': 'K S', 'z': 'Z', 'ch': 'CH', 'sh': 'SH', 'th': 'TH', 'ph': 'F',
    'ng': 'NG'
}

def grapheme_to_phoneme(text: str) -> str:
    text = re.sub(r'[^a-z\s\-]', '', text.lower()).replace('-', ' ')
    words_ph = []
    for word in text.split():
        phones_list = pronouncing.phones_for_word(word)
        if phones_list:
            words_ph.append(phones_list[0])
            continue
        
        i = 0
        n = len(word)
        phones = []
        while i < n:
            if i < n - 1 and word[i:i+2] in GIBBERISH_VOWELS:
                phones.append(GIBBERISH_VOWELS[word[i:i+2]] + '1')
                i += 2
            elif i < n - 1 and word[i:i+2] in GIBBERISH_CONSONANTS:
                phones.append(GIBBERISH_CONSONANTS[word[i:i+2]])
                i += 2
            elif word[i] in GIBBERISH_VOWELS:
                phones.append(GIBBERISH_VOWELS[word[i]] + '1')
                i += 1
            elif word[i] in GIBBERISH_CONSONANTS:
                phones.append(GIBBERISH_CONSONANTS[word[i]])
                i += 1
            else:
                i += 1
        if phones:
            words_ph.append(" ".join(phones))
    return " ".join(words_ph) if words_ph else ""

def parse_query_phonemes(query: str) -> str:
    query = query.strip()
    tokens = query.upper().split()
    is_raw_cmu = True
    for t in tokens:
        t_clean = ''.join(c for c in t if not c.isdigit())
        if t_clean not in CMU_PHONEMES:
            is_raw_cmu = False
            break
    if is_raw_cmu:
        return " ".join(tokens)
    return grapheme_to_phoneme(query)

def get_word_phonemes(word: str) -> str:
    word_clean = word.lower().strip().strip("'")
    if not word_clean:
        return None
    cursor = mem_conn.cursor()
    cursor.execute("SELECT phonemes FROM words WHERE word = ?", (word_clean,))
    row = cursor.fetchone()
    if row:
        return row[0]
    phones_list = pronouncing.phones_for_word(word_clean)
    if phones_list:
        return phones_list[0]
    return None

def count_syllables(phones: str) -> int:
    return sum(1 for p in phones.split() if p[-1].isdigit())

def calculate_density(line: str):
    raw_words = re.findall(r"[a-zA-Z']+", line.lower())
    words_info = []
    for rw in raw_words:
        word = rw.strip("'")
        if not word:
            continue
        phones = get_word_phonemes(word)
        if phones:
            syllables = count_syllables(phones)
            rhyme_part = pronouncing.rhyming_part(phones)
            words_info.append({
                "word": word,
                "syllables": max(1, syllables),
                "rhyme_part": rhyme_part
            })
        else:
            # Fallback syllable count (naive vowel groups)
            vowels = "aeiouy"
            count = 0
            prev_is_vowel = False
            for char in word:
                is_vowel = char in vowels
                if is_vowel and not prev_is_vowel:
                    count += 1
                prev_is_vowel = is_vowel
            if word.endswith('e'):
                count -= 1
            syllables = max(1, count)
            words_info.append({
                "word": word,
                "syllables": syllables,
                "rhyme_part": None
            })
    if not words_info:
        return 0.0, 0, 0
    
    total_syllables = sum(w["syllables"] for w in words_info)
    if total_syllables == 0:
        return 0.0, 0, 0

    # Group by rhyme part (only if it has stress/digits 1 or 2)
    rhyme_groups = {}
    for w in words_info:
        rp = w["rhyme_part"]
        if rp and any(c.isdigit() and c != '0' for c in rp):
            rhyme_groups.setdefault(rp, []).append(w)

    # Mark words that rhyme
    rhyming_words = set()
    for rp, g in rhyme_groups.items():
        if len(g) >= 2:
            for w in g:
                rhyming_words.add(id(w))

    rhyming_syllables = sum(w["syllables"] for w in words_info if id(w) in rhyming_words)
    density = rhyming_syllables / total_syllables
    return density, rhyming_syllables, total_syllables

@app.get("/rhyme-density")
def get_rhyme_density(line: str = Query(..., description="Line to analyze")):
    density, rhyming_syl, total_syl = calculate_density(line)
    
    # Target sweet spot: 0.22 - 0.44
    is_sweet = 0.22 <= density <= 0.44
    if density < 0.22:
        status = "under-rhymed"
    elif density > 0.44:
        status = "over-rhymed"
    else:
        status = "within the sweet spot"
        
    return {
        "line": line,
        "density": round(density, 2),
        "rhyming_syllables": rhyming_syl,
        "total_syllables": total_syl,
        "status": status,
        "message": f"your line sits at {round(density, 2)} — {status} (0.22–0.44)"
    }

@app.get("/phonetic-swap")
def get_phonetic_swap(word: str = Query(..., description="Gibberish or word to swap phonetically")):
    query_phones_str = parse_query_phonemes(word)
    if not query_phones_str:
        return {"word": word, "phonemes": "", "results": []}
        
    query_phones = query_phones_str.split()
    query_vowels = [clean_phoneme(p) for p in query_phones if clean_phoneme(p) in VOWELS]
    query_syllables = len(query_vowels)
    
    scored_candidates = []
    for profile in word_phoneme_profiles:
        # Pre-filter: must be within ±1 syllable
        if abs(profile["syllables"] - query_syllables) > 1:
            continue
            
        dist = phoneme_distance(query_phones, profile["phonemes"])
        
        vowel_match_boost = 0.0
        if profile["vowels"] == query_vowels:
            vowel_match_boost = 1.5
            
        freq_factor = math.log10(profile["frequency"] + 1) * 0.2
        final_score = dist - vowel_match_boost - freq_factor
        
        scored_candidates.append({
            "word": profile["word"],
            "distance": round(dist, 2),
            "vowel_match": profile["vowels"] == query_vowels,
            "frequency": profile["frequency"],
            "score": final_score
        })
        
    scored_candidates.sort(key=lambda x: x["score"])
    results = [s["word"] for s in scored_candidates[:30]]
    
    return {
        "word": word,
        "phonemes": query_phones_str,
        "results": results
    }

@app.get("/synonyms")
def get_synonyms_alias(word: str = Query(..., description="Query word")):
    # Redirect synonyms query to phonetic swap to fulfill the synonym finder replacement
    return get_phonetic_swap(word)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
