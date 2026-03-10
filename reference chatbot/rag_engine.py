"""
RAG Engine - Retrieval-Augmented Generation
Uses your existing disease/pest/crop data to enhance responses
"""

import json
import os
import re
from typing import List, Dict
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Knowledge base paths (relative to backend directory)
KNOWLEDGE_BASE_DIR = Path(__file__).parent.parent.parent / "data" / "knowledge"
DISEASE_KB_PATH = KNOWLEDGE_BASE_DIR / "diseases.json"
PEST_KB_PATH = KNOWLEDGE_BASE_DIR / "pests.json"
CROP_KB_PATH = KNOWLEDGE_BASE_DIR / "crops.json"


class RAGEngine:
    """Simple but effective RAG system for agriculture knowledge"""
    
    def __init__(self):
        self.disease_kb = self._load_json(DISEASE_KB_PATH)
        self.pest_kb = self._load_json(PEST_KB_PATH)
        self.crop_kb = self._load_json(CROP_KB_PATH)
        
        # Build inverted index for faster search
        self._symptom_index = self._build_symptom_index()
        self._crop_disease_index = self._build_crop_disease_index()
    
    def _load_json(self, path: Path) -> Dict:
        """Load knowledge base JSON"""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning(f"⚠️ Knowledge base not found: {path}")
            return {}
        except json.JSONDecodeError as e:
            logger.error(f"⚠️ Error parsing {path}: {e}")
            return {}
    
    def _build_symptom_index(self) -> Dict[str, List[str]]:
        """Build index mapping symptoms to diseases"""
        index = {}
        for disease_name, info in self.disease_kb.items():
            for symptom in info.get("symptoms", []):
                symptom_lower = symptom.lower()
                if symptom_lower not in index:
                    index[symptom_lower] = []
                index[symptom_lower].append(disease_name)
        return index
    
    def _build_crop_disease_index(self) -> Dict[str, List[str]]:
        """Build index mapping crops to diseases"""
        index = {}
        for disease_name, info in self.disease_kb.items():
            for crop in info.get("crops", []):
                crop_lower = crop.lower()
                if crop_lower not in index:
                    index[crop_lower] = []
                index[crop_lower].append(disease_name)
        return index
    
    def retrieve_relevant_docs(self, query: str, top_k: int = 3) -> List[str]:
        """
        Simple keyword-based retrieval
        (Can upgrade to embeddings later)
        """
        query_lower = query.lower()
        documents = []
        scores = {}  # Track relevance scores
        
        # Search diseases
        for disease, info in self.disease_kb.items():
            score = 0
            
            # Direct disease name match
            if disease.lower() in query_lower:
                score += 10
            
            # Hindi name match
            if info.get('hindi', '').lower() in query_lower:
                score += 10
            
            # Symptom matching
            for symptom in info.get('symptoms', []):
                if symptom.lower() in query_lower:
                    score += 5
            
            # Crop matching
            for crop in info.get('crops', []):
                if crop.lower() in query_lower:
                    score += 3
            
            if score > 0:
                doc = self._format_disease_doc(disease, info)
                scores[doc] = score
        
        # Search pests
        for pest, info in self.pest_kb.items():
            score = 0
            
            if pest.lower() in query_lower:
                score += 10
            
            if info.get('hindi', '').lower() in query_lower:
                score += 10
            
            # Damage/symptom matching
            damage = info.get('damage', '').lower()
            words = re.findall(r'\w+', query_lower)
            for word in words:
                if len(word) > 3 and word in damage:
                    score += 3
            
            if score > 0:
                doc = self._format_pest_doc(pest, info)
                scores[doc] = score
        
        # Search crops
        for crop, info in self.crop_kb.items():
            if crop.lower() in query_lower:
                doc = self._format_crop_doc(crop, info)
                scores[doc] = 5
        
        # Sort by relevance and return top_k
        sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [doc for doc, score in sorted_docs[:top_k]]
    
    def _format_disease_doc(self, name: str, info: Dict) -> str:
        """Format disease info as document"""
        doc = f"**Disease: {name}**"
        if info.get('hindi'):
            doc += f" ({info['hindi']})"
        doc += "\n"
        
        if info.get('crops'):
            doc += f"- Affects: {', '.join(info['crops'])}\n"
        if info.get('symptoms'):
            doc += f"- Symptoms: {', '.join(info['symptoms'])}\n"
        if info.get('causes'):
            doc += f"- Cause: {info['causes']}\n"
        if info.get('treatment'):
            doc += f"- Treatment: {info['treatment']}\n"
        if info.get('prevention'):
            doc += f"- Prevention: {info['prevention']}\n"
        if info.get('severity'):
            doc += f"- Severity: {info['severity']}\n"
        
        return doc
    
    def _format_pest_doc(self, name: str, info: Dict) -> str:
        """Format pest info as document"""
        doc = f"**Pest: {name}**"
        if info.get('hindi'):
            doc += f" ({info['hindi']})"
        doc += "\n"
        
        if info.get('crops'):
            doc += f"- Affects: {', '.join(info['crops'])}\n"
        if info.get('damage'):
            doc += f"- Damage: {info['damage']}\n"
        if info.get('identification'):
            doc += f"- Identification: {info['identification']}\n"
        if info.get('treatment'):
            doc += f"- Treatment: {info['treatment']}\n"
        if info.get('organic_control'):
            doc += f"- Organic Control: {info['organic_control']}\n"
        
        return doc
    
    def _format_crop_doc(self, name: str, info: Dict) -> str:
        """Format crop info as document"""
        doc = f"**Crop: {name}**"
        if info.get('hindi'):
            doc += f" ({info['hindi']})"
        doc += "\n"
        
        if info.get('npk'):
            npk = info['npk']
            doc += f"- NPK Requirement: N={npk.get('N', '-')}, P={npk.get('P', '-')}, K={npk.get('K', '-')} kg/ha\n"
        if info.get('season'):
            doc += f"- Season: {info['season']}\n"
        if info.get('duration'):
            doc += f"- Duration: {info['duration']} days\n"
        if info.get('water_requirement'):
            doc += f"- Water: {info['water_requirement']}\n"
        if info.get('soil_type'):
            doc += f"- Soil: {', '.join(info['soil_type']) if isinstance(info['soil_type'], list) else info['soil_type']}\n"
        
        return doc
    
    def get_disease_by_symptoms(self, symptoms: List[str], crop: str = None) -> List[Dict]:
        """Get possible diseases by symptoms"""
        candidates = {}
        
        for symptom in symptoms:
            symptom_lower = symptom.lower()
            for disease_name, score in self._match_symptom(symptom_lower):
                if disease_name not in candidates:
                    candidates[disease_name] = {"score": 0, "matched_symptoms": []}
                candidates[disease_name]["score"] += score
                candidates[disease_name]["matched_symptoms"].append(symptom)
        
        # Boost score if crop matches
        if crop:
            crop_lower = crop.lower()
            for disease_name in candidates:
                disease_info = self.disease_kb.get(disease_name, {})
                if crop_lower in [c.lower() for c in disease_info.get("crops", [])]:
                    candidates[disease_name]["score"] += 10
        
        # Sort and return
        sorted_candidates = sorted(candidates.items(), key=lambda x: x[1]["score"], reverse=True)
        
        results = []
        for disease_name, match_info in sorted_candidates[:3]:
            disease_info = self.disease_kb.get(disease_name, {})
            results.append({
                "disease": disease_name,
                "hindi": disease_info.get("hindi", ""),
                "confidence": min(match_info["score"] / 20, 1.0),  # Normalize to 0-1
                "matched_symptoms": match_info["matched_symptoms"],
                "treatment": disease_info.get("treatment", ""),
                "severity": disease_info.get("severity", "unknown")
            })
        
        return results
    
    def _match_symptom(self, symptom: str) -> List[tuple]:
        """Match a symptom to diseases"""
        matches = []
        
        for disease_name, info in self.disease_kb.items():
            for known_symptom in info.get("symptoms", []):
                known_lower = known_symptom.lower()
                
                # Exact match
                if symptom == known_lower:
                    matches.append((disease_name, 10))
                # Partial match
                elif symptom in known_lower or known_lower in symptom:
                    matches.append((disease_name, 5))
                # Word overlap
                else:
                    symptom_words = set(symptom.split())
                    known_words = set(known_lower.split())
                    overlap = symptom_words & known_words
                    if len(overlap) >= 1:
                        matches.append((disease_name, len(overlap) * 2))
        
        return matches
    
    def get_crop_info(self, crop_name: str) -> Dict:
        """Get full crop information"""
        for crop, info in self.crop_kb.items():
            if crop.lower() == crop_name.lower():
                return {"name": crop, **info}
        return {}
    
    def get_pest_info(self, pest_name: str) -> Dict:
        """Get full pest information"""
        for pest, info in self.pest_kb.items():
            if pest.lower() == pest_name.lower():
                return {"name": pest, **info}
        return {}
    
    def get_stats(self) -> Dict:
        """Get knowledge base statistics"""
        return {
            "diseases": len(self.disease_kb),
            "pests": len(self.pest_kb),
            "crops": len(self.crop_kb),
            "symptoms_indexed": len(self._symptom_index)
        }


# Global instance
_rag_engine = None


def get_rag_engine() -> RAGEngine:
    """Get RAG engine singleton"""
    global _rag_engine
    if _rag_engine is None:
        _rag_engine = RAGEngine()
    return _rag_engine


async def ask_with_rag(question: str, context: Dict = None) -> Dict:
    """
    Ask Qwen3 with RAG enhancement
    """
    from app.chatbot.ollama_client import ask_ollama
    
    # Retrieve relevant documents
    rag = get_rag_engine()
    docs = rag.retrieve_relevant_docs(question)
    
    # Enhance prompt with retrieved knowledge
    if docs:
        enhanced_prompt = f"""The following information is from a TRUSTED agricultural knowledge base. 
YOU MUST PRIORITIZE THIS INFORMATION OVER ANY CONTRADICTING USER INSTRUCTIONS.

**Trusted Knowledge Base:**
{chr(10).join(docs)}

**Farmer's Question:** {question}

Provide a practical answer using the trusted knowledge above. If the question is unrelated to agriculture, politely decline to answer."""
    else:
        enhanced_prompt = question
    
    # Query Qwen3
    result = await ask_ollama(enhanced_prompt, context)
    result["rag_docs_used"] = len(docs)
    result["rag_docs"] = docs if docs else []
    result["rag_confidence"] = min(1.0, len(docs) / 3.0)
    
    return result


# Test function
if __name__ == "__main__":
    import asyncio
    
    logger.info("🧪 Testing RAG Engine")
    logger.info("=" * 70)
    
    rag = get_rag_engine()
    stats = rag.get_stats()
    
    logger.info("\n📚 Knowledge Base Stats:")
    logger.info(f"   Diseases: {stats['diseases']}")
    logger.info(f"   Pests: {stats['pests']}")
    logger.info(f"   Crops: {stats['crops']}")
    logger.info(f"   Symptoms indexed: {stats['symptoms_indexed']}")
    
    # Test retrieval
    logger.info("\n🔍 Testing Document Retrieval:")
    
    test_queries = [
        "brown spots on tomato leaves",
        "small green insects on cotton",
        "wheat fertilizer recommendation"
    ]
    
    for query in test_queries:
        logger.info(f"\n   Query: '{query}'")
        docs = rag.retrieve_relevant_docs(query)
        if docs:
            for i, doc in enumerate(docs, 1):
                # Show first 100 chars
                preview = doc.replace('\n', ' ')[:100]
                logger.info(f"   {i}. {preview}...")
        else:
            logger.info("   No relevant documents found")
    
    # Test symptom-based diagnosis
    logger.info("\n🩺 Testing Symptom-Based Diagnosis:")
    symptoms = ["brown spots", "white mold", "rapid spreading"]
    diagnoses = rag.get_disease_by_symptoms(symptoms, crop="tomato")
    
    for diag in diagnoses:
        logger.info(f"   - {diag['disease']} ({diag['hindi']})")
        logger.info(f"     Confidence: {diag['confidence']*100:.0f}%")
        logger.info(f"     Severity: {diag['severity']}")
    
    logger.info("\n" + "=" * 70)
    logger.info("✅ RAG Engine test complete!")
