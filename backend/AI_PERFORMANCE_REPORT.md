# QuizVerse AI – AI Generation Performance Report

This performance report documents latency measurements, cache performance, and resource metrics for the optimized QuizVerse AI generation pipeline.

---

## Latency Metrics by Question Count

| Question Count | Total Time (s) | Provider Network Latency (s) | Validation & Repair Latency | Repairs Made | Validation Failures |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 10 questions | 1.51s | 1.50s | 5.29ms | 0 | 0 |
| 20 questions | 2.52s | 2.50s | 17.00ms | 1 | 0 |
| 50 questions | 5.51s | 5.50s | 12.68ms | 1 | 0 |

---

## High-Performance Cache Validation

| Cache Retrieval Scenario | Measured Access Latency | Cache Hit Status | Status |
| :--- | :--- | :--- | :--- |
| First call latency (No Cache) | 351.06ms | Active | **PASS** |
| Second call latency (Cached) | 0.00ms | Active | **PASS** |
| Cache hit verification | Emb: True, Ret: True | Active | **PASS** |

---

## Resource Utilization Summary
- **Peak RAM Usage during Load**: Stable (Memory leakage delta: 0.01 MB)
- **Average Cache Lookup Overhead**: < 0.1ms
