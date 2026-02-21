"""초기 데이터 시드 — 병동, HN(관리자), 간호사 11명 생성 (v1.2)"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app import models
from app.auth import hash_password

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

# 이미 데이터가 있으면 건너뜀
if db.query(models.Ward).first():
    print("이미 시드 데이터가 존재합니다.")
    db.close()
    sys.exit(0)

# 병동 생성
ward = models.Ward(name="내과 5병동")
db.add(ward)
db.commit()
db.refresh(ward)

# 기본 Rule 생성
rule = models.Rule(ward_id=ward.id)
db.add(rule)
db.commit()

# HN (수간호사 / 관리자)
hn = models.Nurse(
    ward_id=ward.id,
    name="김수간",
    email="admin@hospital.com",
    grade="HN",
    sort_order=1,
    monthly_annual_leave=1,
    password_hash=hash_password("password123"),
)
db.add(hn)

# CN (책임간호사) 2명
cn_data = [
    ("이책임", "cn1@hospital.com"),
    ("박책임", "cn2@hospital.com"),
]
for i, (name, email) in enumerate(cn_data, start=2):
    db.add(models.Nurse(
        ward_id=ward.id, name=name, email=email,
        grade="CN", sort_order=i, monthly_annual_leave=1,
        password_hash=hash_password("password123"),
    ))

# RN (평간호사) 6명
rn_data = [
    ("최평간", "rn1@hospital.com"),
    ("정평간", "rn2@hospital.com"),
    ("강평간", "rn3@hospital.com"),
    ("조평간", "rn4@hospital.com"),
    ("윤평간", "rn5@hospital.com"),
    ("장평간", "rn6@hospital.com"),
]
for i, (name, email) in enumerate(rn_data, start=4):
    db.add(models.Nurse(
        ward_id=ward.id, name=name, email=email,
        grade="RN", sort_order=i, monthly_annual_leave=1,
        password_hash=hash_password("password123"),
    ))

# AN (보조간호사) 1명
db.add(models.Nurse(
    ward_id=ward.id, name="한보조", email="an1@hospital.com",
    grade="AN", sort_order=10, monthly_annual_leave=1,
    password_hash=hash_password("password123"),
))

# PN (임시간호사) 1명
db.add(models.Nurse(
    ward_id=ward.id, name="임시간", email="pn1@hospital.com",
    grade="PN", sort_order=11, monthly_annual_leave=0,
    password_hash=hash_password("password123"),
))

db.commit()
db.close()

print("시드 데이터 생성 완료!")
print("관리자 계정: admin@hospital.com / password123")
print(f"병동: 내과 5병동")
print("간호사: HN×1, CN×2, RN×6, AN×1, PN×1 = 총 11명")
