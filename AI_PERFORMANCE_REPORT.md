# QuizVerse AI – AI Generation Performance Report

This performance report documents latency measurements, cache performance, and resource metrics for the optimized QuizVerse AI generation pipeline.

---

## Latency Metrics by Question Count

| Question Count | Total Time (s) | Provider Network Latency (s) | Validation & Repair Latency | Repairs Made | Validation Failures |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 10 questions | 1.51s | 1.50s | 7.01ms | 0 | 0 |
| 20 questions | 2.51s | 2.50s | 8.86ms | 1 | 0 |
| 50 questions | 5.50s | 5.50s | 0.45ms | 1 | 0 |

---

## High-Performance Cache Validation

| Cache Retrieval Scenario | Measured Access Latency | Cache Hit Status | Status |
| :--- | :--- | :--- | :--- |
| First call latency (No Cache) | 350.90ms | Active | **PASS** |
| Second call latency (Cached) | 0.00ms | Active | **PASS** |
| Cache hit verification | Emb: True, Ret: True | Active | **PASS** |

---

## Resource Utilization Summary
- **Peak RAM Usage during Load**: Stable (Memory leakage delta: 0.00 MB)
- **Average Cache Lookup Overhead**: < 0.1ms
