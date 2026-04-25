let ifaKnowledgeBase = {};

async function loadIfaKnowledgeBase() {
  try {
    const res = await fetch("/api/knowledgebase");
    if (!res.ok) throw new Error("Failed to fetch Ifá knowledge base");
    ifaKnowledgeBase = await res.json();
    // console.log("Ifá Knowledge Base Loaded:", Object.keys(ifaKnowledgeBase).length);
  } catch (error) {
    console.error("Error loading Ifá Knowledge Base:", error);
  }
}

// 🔄 Load KB once page is ready
document.addEventListener("DOMContentLoaded", loadIfaKnowledgeBase);