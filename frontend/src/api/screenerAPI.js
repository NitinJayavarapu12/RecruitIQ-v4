import axios from "axios";

const BASE = (import.meta.env.VITE_API_URL || "") + "/api";

export async function pingBackend() {
  try {
    await axios.get(`${BASE}/health`, { timeout: 60000 });
  } catch (_) {}
}

export async function analyzeJDFile(file) {
  const form = new FormData();
  form.append("jd_file", file);
  const res = await axios.post(`${BASE}/analyze-jd`, form);
  return res.data;
}

export async function analyzeJDText(text) {
  const form = new FormData();
  form.append("jd_text", text);
  const res = await axios.post(`${BASE}/analyze-jd-text`, form);
  return res.data;
}

export async function analyzeJDUrl(url) {
  const form = new FormData();
  form.append("url", url);
  const res = await axios.post(`${BASE}/analyze-jd-url`, form);
  return res.data;
}

export async function refineSkills(jdText, feedback) {
  const form = new FormData();
  form.append("jd_text", jdText);
  form.append("feedback", feedback || "find more specific technical skills");
  const res = await axios.post(`${BASE}/refine-skills`, form);
  return res.data;
}

export async function startScreening({
  jdFile, resumeFiles, topN, primarySkills, secondarySkills, jdTextOverride,
  filterSkills, filterMode,
}) {
  const form = new FormData();
  if (jdFile) form.append("jd_file", jdFile);
  resumeFiles.forEach(f => form.append("resume_files", f));
  form.append("top_n", topN);
  form.append("primary_skills", JSON.stringify(primarySkills || []));
  form.append("secondary_skills", JSON.stringify(secondarySkills || []));
  form.append("jd_text_override", jdTextOverride || "");
  form.append("filter_skills", JSON.stringify(filterSkills || []));
  form.append("filter_mode", filterMode || "OR");
  const res = await axios.post(`${BASE}/screen`, form);
  return res.data;
}

export function subscribeToProgress(jobId, onUpdate) {
  const es = new EventSource(`${BASE}/progress/${jobId}`);
  es.onmessage = e => {
    try { onUpdate(JSON.parse(e.data)); } catch (_) {}
  };
  return es;
}

export async function getResults(jobId) {
  const res = await axios.get(`${BASE}/results/${jobId}`);
  return res.data;
}

export function downloadExcel(jobId) {
  const link = document.createElement("a");
  link.href = `${BASE}/download/${jobId}`;
  link.click();
}

export function downloadZip(jobId) {
  const link = document.createElement("a");
  link.href = `${BASE}/download-zip/${jobId}`;
  link.click();
}
