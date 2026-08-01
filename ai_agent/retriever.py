"""
BlindHire RAG — Soru Vektör Veritabanı ve Retriever Modülü

JSON formatındaki teknik soru veri setini embedding vektörlerine dönüştürüp
FAISS vektör veritabanına yükler. Semantik arama ile en uygun soruları bulur.

Kullanılan teknolojiler:
    - HuggingFace sentence-transformers (lokal, ücretsiz, API key gerektirmez)
    - FAISS (Facebook AI Similarity Search) — bellek içi vektör veritabanı
    - LangChain entegrasyonu

Kullanım:
    retriever = QuestionRetriever()
    results = retriever.search("Python'da bellek yönetimi", k=3)
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

logger = logging.getLogger("blindhire.retriever")


class QuestionRetriever:
    """
    BlindHire RAG soru veri setini vektör veritabanına yükleyen ve
    semantik arama ile en uygun soruları bulan retriever sınıfı.

    Attributes:
        data_path: JSON soru dosyasının yolu.
        embeddings: HuggingFace embedding modeli.
        documents: LangChain Document nesneleri listesi.
        vector_store: FAISS vektör veritabanı.
    """

    DEFAULT_DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "tech_questions.json")
    DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

    def __init__(
        self,
        data_path: Optional[str] = None,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL
    ):
        """
        Retriever'ı başlatır: embedding modelini yükler, soruları JSON'dan okur
        ve FAISS vektör indeksini oluşturur.

        Args:
            data_path: Soru JSON dosyasının yolu. None ise varsayılan yol kullanılır.
            embedding_model: HuggingFace embedding model adı.
        """
        self.data_path = data_path or self.DEFAULT_DATA_PATH

        logger.info(f"[Retriever] Embedding modeli yukleniyor: {embedding_model}")
        try:
            self.embeddings = HuggingFaceEmbeddings(
                model_name=embedding_model,
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True}
            )
        except Exception as e:
            logger.warning(f"[Retriever Warning] HuggingFace Hub baglanti uyarisi ({e}), yerel onbellek deneniyor...")
            try:
                self.embeddings = HuggingFaceEmbeddings(
                    model_name=embedding_model,
                    model_kwargs={"device": "cpu", "local_files_only": True},
                    encode_kwargs={"normalize_embeddings": True}
                )
            except Exception as e2:
                logger.error(f"[Retriever Error] Embedding yuklenemedi: {e2}")
                raise e2

        self.documents: List[Document] = self._load_questions()
        self.vector_store: FAISS = self._build_index()
        logger.info(f"[Retriever] {len(self.documents)} soru basariyla indekslendi.")

    def _load_questions(self) -> List[Document]:
        """
        JSON dosyasından soruları okuyup LangChain Document nesnelerine dönüştürür.
        Her sorunun aranabilir metni; soru, beklenen cevap ve ipuçlarını içerir.

        Returns:
            LangChain Document nesnelerinin listesi.
        """
        with open(self.data_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        documents = []
        for q in data["questions"]:
            # Semantik arama kalitesini artırmak için soru, cevap ve
            # ipuçlarını birleştirip tek bir aranabilir metin oluşturuyoruz
            searchable_text = (
                f"Soru: {q['question']}\n"
                f"Beklenen Cevap: {q['expected_answer']}\n"
                f"İpuçları: {', '.join(q['hints'])}"
            )

            doc = Document(
                page_content=searchable_text,
                metadata={
                    "id": q["id"],
                    "category": q["category"],
                    "difficulty": q["difficulty"],
                    "interview_stage": q["interview_stage"],
                    "question": q["question"],
                    "expected_answer": q["expected_answer"],
                    "hints": json.dumps(q["hints"], ensure_ascii=False),
                    "evaluation_criteria": json.dumps(q["evaluation_criteria"], ensure_ascii=False)
                }
            )
            documents.append(doc)

        return documents

    def _build_index(self) -> FAISS:
        """
        Yüklenen Document'lardan FAISS vektör indeksini oluşturur.

        Returns:
            FAISS vektör veritabanı nesnesi.
        """
        return FAISS.from_documents(self.documents, self.embeddings)

    def search(
        self,
        query: str,
        k: int = 3,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        interview_stage: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Semantik arama ile verilen sorguya en uygun soruları döner.

        Args:
            query: Arama metni (ör: "Python'da bellek yönetimi").
            k: Döndürülecek maksimum sonuç sayısı.
            category: Opsiyonel kategori filtresi (ör: "python_fundamentals").
            difficulty: Opsiyonel zorluk filtresi (ör: "hard").
            interview_stage: Opsiyonel mülakat aşaması filtresi (ör: "TECHNICAL_1").

        Returns:
            Eşleşen soruların sözlük listesi. Her sözlük soru bilgilerini
            ve 0-1 arasında bir benzerlik skorunu içerir.
        """
        # Metadata filtresi oluştur
        filter_dict = {}
        if category:
            filter_dict["category"] = category
        if difficulty:
            filter_dict["difficulty"] = difficulty
        if interview_stage:
            filter_dict["interview_stage"] = interview_stage

        # FAISS'te arama yap
        # fetch_k: filtreleme öncesi çekilecek aday sayısı (küçük veri setinde tamamını tara)
        search_kwargs = {"k": k, "fetch_k": len(self.documents)}

        if filter_dict:
            results = self.vector_store.similarity_search_with_score(
                query, filter=filter_dict, **search_kwargs
            )
        else:
            results = self.vector_store.similarity_search_with_score(
                query, **search_kwargs
            )

        # Sonuçları formatla
        formatted = []
        for doc, distance in results:
            # Normalize edilmiş vektörlerde L2 mesafesi [0, 2] aralığında.
            # Kosinüs benzerliğine dönüşüm: cos_sim = 1 - (L2^2 / 2)
            cosine_similarity = max(0.0, 1.0 - (distance / 2.0))

            formatted.append({
                "id": doc.metadata["id"],
                "category": doc.metadata["category"],
                "difficulty": doc.metadata["difficulty"],
                "interview_stage": doc.metadata["interview_stage"],
                "question": doc.metadata["question"],
                "expected_answer": doc.metadata["expected_answer"],
                "hints": json.loads(doc.metadata["hints"]),
                "evaluation_criteria": json.loads(doc.metadata["evaluation_criteria"]),
                "relevance_score": round(cosine_similarity, 4)
            })

        return formatted

    def get_question_by_id(self, question_id: str) -> Optional[Dict[str, Any]]:
        """
        ID ile spesifik bir soruyu döner.

        Args:
            question_id: Soru ID'si (ör: "PY-001").

        Returns:
            Soru bilgilerini içeren sözlük veya bulunamazsa None.
        """
        for doc in self.documents:
            if doc.metadata["id"] == question_id:
                meta = doc.metadata.copy()
                meta["hints"] = json.loads(meta["hints"])
                meta["evaluation_criteria"] = json.loads(meta["evaluation_criteria"])
                return meta
        return None

    def get_questions_by_stage(self, stage: str) -> List[Dict[str, Any]]:
        """
        Belirli bir mülakat aşamasına ait tüm soruları döner.

        Args:
            stage: Mülakat aşaması (ör: "TECHNICAL_1", "TECHNICAL_2", "SCENARIO").

        Returns:
            İlgili aşamaya ait soru listesi.
        """
        results = []
        for doc in self.documents:
            if doc.metadata["interview_stage"] == stage:
                meta = doc.metadata.copy()
                meta["hints"] = json.loads(meta["hints"])
                meta["evaluation_criteria"] = json.loads(meta["evaluation_criteria"])
                results.append(meta)
        return results


# ─────────────────────────────────────────────────────────────
# Modül doğrudan çalıştırıldığında test senaryosunu yürüt
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("BLINDHIRE RAG — RETRIEVER TEST")
    print("=" * 60)

    retriever = QuestionRetriever()

    # Test 1: Genel semantik arama
    print("\n[TEST 1] Arama: 'Python bellek yönetimi ve garbage collection'")
    print("-" * 50)
    results = retriever.search("Python bellek yönetimi ve garbage collection", k=3)
    for r in results:
        print(f"  [{r['id']}] Skor: {r['relevance_score']} | {r['question'][:80]}...")

    # Test 2: Kategori filtreli arama
    print("\n[TEST 2] Arama: 'ölçekleme' (kategori: system_design)")
    print("-" * 50)
    results = retriever.search("ölçekleme ve yüksek trafik", k=3, category="system_design")
    for r in results:
        print(f"  [{r['id']}] Skor: {r['relevance_score']} | {r['question'][:80]}...")

    # Test 3: Mülakat aşamasına göre filtreleme
    print("\n[TEST 3] Arama: 'hata ayıklama' (aşama: SCENARIO)")
    print("-" * 50)
    results = retriever.search("production hata ayıklama", k=2, interview_stage="SCENARIO")
    for r in results:
        print(f"  [{r['id']}] Skor: {r['relevance_score']} | {r['question'][:80]}...")

    # Test 4: ID ile soru getirme
    print("\n[TEST 4] ID ile soru: AI-001")
    print("-" * 50)
    q = retriever.get_question_by_id("AI-001")
    if q:
        print(f"  Soru: {q['question'][:100]}...")
        print(f"  Kategori: {q['category']} | Zorluk: {q['difficulty']}")

    # Test 5: Aşamaya göre soru sayısı
    print("\n[TEST 5] Aşama bazlı soru sayıları")
    print("-" * 50)
    for stage in ["TECHNICAL_1", "TECHNICAL_2", "SCENARIO"]:
        questions = retriever.get_questions_by_stage(stage)
        print(f"  {stage}: {len(questions)} soru")

    print("\n" + "=" * 60)
    print("Tüm testler tamamlandı.")
    print("=" * 60)
