"""v1.2 DB 마이그레이션 — 신규 컬럼 추가 및 데이터 이전"""
import sys
import os
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nursesch.db")


def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"DB 파일이 없습니다: {DB_PATH}")
        print("seed.py를 먼저 실행하세요.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("=== v1.2 마이그레이션 시작 ===")

    # Nurse 테이블: dedicated_shift, weekday_preference, weekend_preference
    if not column_exists(cur, "nurses", "dedicated_shift"):
        cur.execute("ALTER TABLE nurses ADD COLUMN dedicated_shift VARCHAR(5) DEFAULT NULL")
        print("  + nurses.dedicated_shift 추가")
    if not column_exists(cur, "nurses", "weekday_preference"):
        cur.execute("ALTER TABLE nurses ADD COLUMN weekday_preference VARCHAR(5) DEFAULT NULL")
        print("  + nurses.weekday_preference 추가")
    if not column_exists(cur, "nurses", "weekend_preference"):
        cur.execute("ALTER TABLE nurses ADD COLUMN weekend_preference VARCHAR(5) DEFAULT NULL")
        print("  + nurses.weekend_preference 추가")

    # is_night_dedicated → dedicated_shift 데이터 이전
    cur.execute("UPDATE nurses SET dedicated_shift = 'N' WHERE is_night_dedicated = 1 AND (dedicated_shift IS NULL OR dedicated_shift = '')")
    migrated = cur.rowcount
    if migrated > 0:
        print(f"  * is_night_dedicated=True → dedicated_shift='N' 이전: {migrated}명")

    # Rule 테이블: max_monthly_night_shifts
    if not column_exists(cur, "rules", "max_monthly_night_shifts"):
        cur.execute("ALTER TABLE rules ADD COLUMN max_monthly_night_shifts INTEGER DEFAULT 0")
        print("  + rules.max_monthly_night_shifts 추가")

    # NurseMonthlyLeave 테이블: total_off_days_override
    if not column_exists(cur, "nurse_monthly_leaves", "total_off_days_override"):
        cur.execute("ALTER TABLE nurse_monthly_leaves ADD COLUMN total_off_days_override INTEGER DEFAULT NULL")
        print("  + nurse_monthly_leaves.total_off_days_override 추가")

    conn.commit()
    conn.close()

    print("=== v1.2 마이그레이션 완료 ===")


if __name__ == "__main__":
    migrate()
