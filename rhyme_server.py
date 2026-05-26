import sqlite3
from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
import pronouncing
from pydantic import BaseModel
from typing import List

# Global DB connection and cached unique endings, and SentenceTransformer model
mem_conn = None
unique_word_endings = []
unique_bigram_endings = []
sentence_model = None

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
    global mem_conn, unique_word_endings, unique_bigram_endings, sentence_model
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
