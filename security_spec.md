# Scribble IT Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every path not explicitly matched is denied for both read and write.
2. **Verified Identity Ownership**: Only verified Firebase authenticated users (`request.auth != null && request.auth.token.email_verified == true`) may access their own workspace (`/workspaces/{ownerUid}`) and subcollections, with a verified admin override (`neerej.suresan.s@gmail.com` or `/admins/{uid}`).
3. **Master Gate Relational Sync**: Every subcollection document (`tenants`, `incidents`, `service_requests`, `module_state`) requires the parent `/workspaces/{ownerUid}` document to exist and belong to `request.auth.uid` via `get()`.
4. **Strict Payload & Path Validation**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (`size <= 128`). Every string enforces explicit `.size()` bounds matching `firebase-blueprint.json`. Every list enforces explicit `.size()` upper bounds.
5. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on create and remain immutable (`incoming().createdAt == existing().createdAt`) on update; `updatedAt` must equal `request.time` on create and update; `ownerUid` and `id` are immutable after creation.
6. **Terminal State Locking**: Closed incidents (`status == 'closed'`) and completed/rejected service requests (`status == 'completed' || status == 'rejected'`) cannot be modified by non-admin users once terminal.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Reading or writing `/workspaces/userA/incidents/INC-1` with `request.auth == null`.
2. **Unverified Email Spoof**: Accessing `/workspaces/adminUid` with `email: "neerej.suresan.s@gmail.com"` but `email_verified: false`.
3. **Cross-Tenant / Cross-User PII Read**: Authenticated `userB` attempting `get` or `list` on `/workspaces/userA/incidents` or `/workspaces/userA/tenants`.
4. **Identity Spoofing on Create**: `userA` creating `/workspaces/userA/incidents/INC-1` with `ownerUid: "userB"`.
5. **Orphaned Subcollection Write (Master Gate Bypass)**: Creating `/workspaces/userA/tenants/t1` before `/workspaces/userA` exists.
6. **Shadow Field Injection (Create)**: Creating a tenant profile with an unlisted ghost field `isSuperAdmin: true`.
7. **Shadow Field Injection (Update)**: Updating an incident with an unlisted ghost field `bypassSla: true`.
8. **ID Poisoning**: Creating a document with path ID `../../admins/evil` or a 200-character document ID.
9. **Resource Exhaustion / Value Poisoning**: Writing a 300KB string into `title` or an array of 1000 items into `activityLog`.
10. **Timestamp Forgery**: Creating a workspace or incident with a backdated client timestamp instead of `request.time`.
11. **Immutable Field Tampering**: Updating an existing incident to change `createdAt` or `ownerUid`.
12. **Terminal State Mutation**: Non-admin user attempting to overwrite a `closed` incident or `completed` service request.
