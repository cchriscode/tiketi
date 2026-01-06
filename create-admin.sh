#!/bin/bash
# Create admin account manually

set -e

echo "🔐 Creating admin account..."

POSTGRES_POD=$(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')

echo "📦 PostgreSQL Pod: $POSTGRES_POD"

# Create admin account with bcrypt hash for password "admin123"
# This hash was generated with: bcrypt.hash('admin123', 10)
kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi <<EOF
INSERT INTO auth_schema.users (email, password_hash, name, phone, role)
VALUES (
  'admin@tiketi.gg',
  '\$2b\$10\$N9qo8uLOickgx2ZMRZoMye7K7GcmP7aWvPvPzOqWJ0rqvhJz.zzFe',
  'Admin',
  '010-0000-0000',
  'admin'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin';
EOF

echo ""
echo "✅ Admin account created/updated successfully!"
echo ""
echo "Login credentials:"
echo "  Email:    admin@tiketi.gg"
echo "  Password: admin123"
echo ""
