# QuizVerse AI Disaster Recovery (DR) Plan

This document outlines the policy, objectives, and recovery procedures in the event of a catastrophic system failure (e.g., database corruption, cloud provider outage, or data center loss).

---

## 1. DR Objectives

- **RPO (Recovery Point Objective)**: **24 hours**. This represents the maximum acceptable age of data that can be lost due to an outage. (Can be reduced to < 1 hour with replica promotion).
- **RTO (Recovery Time Objective)**: **2 hours**. This is the target time to restore fully functional services after a disaster declaration.

---

## 2. Disaster Scenarios & Playbooks

### Scenario A: Database Corruption or Data Deletion

#### Objective: Restore database state to the last clean daily backup.
1. **Identify the latest valid backup**:
   Check the backup storage (e.g., S3 bucket or `/backups` directory on the host) and download the most recent `.sql.gz` file.
2. **Execute restoration**:
   Copy the backup file to the database server (or run inside the database container):
   ```bash
   # Run the restoration script
   /bin/bash scripts/db_restore.sh /path/to/backup_file.sql.gz
   ```
3. **Verify Restoration**:
   Log into the application and query user records or quiz attempts to ensure integrity. Run schema verification using:
   ```bash
   python backend/inspect_db.py
   ```

---

### Scenario B: Primary Database Server Outage (Failover to Replica)

#### Objective: Promote a read-replica to primary to restore write capabilities.
1. **Promote the Replica**:
   For AWS RDS or self-hosted PostgreSQL clusters:
   Run the promotion command on the replica host:
   ```bash
   pg_ctl promote -D /var/lib/postgresql/data
   ```
2. **Update Application Environment Configuration**:
   Change the `DATABASE_URL` environment variable on the backend containers to point to the new primary database host.
3. **Restart backend containers**:
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```
4. **Verify Connectivity**:
   Call `/health/db` on all backend instances to ensure they successfully connect to the promoted database.

---

### Scenario C: Cloud Provider Regional Outage (Complete Relocation)

#### Objective: Re-create the environment in an alternative cloud region (e.g., AWS us-east-1 to us-west-2).
1. **Provision Infrastructure**:
   Spin up new virtual hosts and managed databases using Terraform or cloud console templates in the backup region.
2. **Clone and Build Containers**:
   Pull the production images from the registry (e.g., Docker Hub or ECR) or rebuild from code:
   ```bash
   docker compose -f docker-compose.prod.yml build
   ```
3. **Restore Database State**:
   Download the latest database backup from cross-region replication storage, and restore it on the new database cluster using the `db_restore.sh` script.
4. **Update DNS Records**:
   Update your DNS configuration (e.g., AWS Route 53, Cloudflare) to point the primary domain `quizverse.ai` to the new Load Balancer IP address.
5. **Monitor Traffic**:
   Review Nginx access logs to verify that traffic is shifting to the new region.
