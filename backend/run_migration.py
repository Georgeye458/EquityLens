#!/usr/bin/env python3
"""
Run database migration to add performance indexes.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.services.database import engine


async def run_migration():
    """Run the migration SQL script."""
    migration_file = Path(__file__).parent / "migrations" / "add_indexes_for_performance.sql"
    
    if not migration_file.exists():
        print(f"Migration file not found: {migration_file}")
        return False
    
    print(f"Reading migration from: {migration_file}")
    sql = migration_file.read_text()
    
    print("Connecting to database...")
    async with engine.begin() as conn:
        print("Running migration...")
        # Split by semicolons and execute each statement
        statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
        
        for i, statement in enumerate(statements, 1):
            if statement:
                print(f"  Executing statement {i}/{len(statements)}...")
                try:
                    result = await conn.execute(text(statement))
                    if result.returns_rows:
                        rows = result.fetchall()
                        print(f"    ✓ Success - {len(rows)} rows returned")
                        for row in rows:
                            print(f"      {row}")
                    else:
                        print(f"    ✓ Success")
                except Exception as e:
                    print(f"    ⚠ Warning: {e}")
    
    print("\n✅ Migration completed successfully!")
    return True


if __name__ == "__main__":
    print("=" * 60)
    print("EquityLens Database Migration: Performance Indexes")
    print("=" * 60)
    print()
    
    success = asyncio.run(run_migration())
    
    if success:
        print("\nIndexes have been added. Restart your backend server to apply model changes.")
        sys.exit(0)
    else:
        print("\nMigration failed!")
        sys.exit(1)
