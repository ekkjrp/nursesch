import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 개발용 시드 데이터: 병동 1개, 관리자 1명, 간호사 9명
async function main() {
  // 기존 데이터 삭제
  await prisma.scheduleEntry.deleteMany();
  await prisma.shiftRequest.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.nurse.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.ward.deleteMany();

  // 병동 생성
  const ward = await prisma.ward.create({ data: { name: '내과 5병동' } });

  // 기본 규칙 생성
  await prisma.rule.create({
    data: {
      wardId: ward.id,
      weekdayDayCount: 3,
      weekdayEveningCount: 2,
      weekdayNightCount: 2,
      weekendDayCount: 2,
      weekendEveningCount: 2,
      weekendNightCount: 2,
    },
  });

  const password = await bcrypt.hash('password123', 10);

  // 관리자 (수간호사)
  await prisma.nurse.create({
    data: {
      wardId: ward.id, name: '김수간', email: 'admin@hospital.com',
      role: 'ADMIN', skillLevel: 'CHARGE', passwordHash: password,
    },
  });

  // 간호사 9명 (다양한 숙련도)
  const nurses = [
    { name: '이영희', email: 'nurse1@hospital.com', skillLevel: 'CHARGE' },
    { name: '박지민', email: 'nurse2@hospital.com', skillLevel: 'SENIOR' },
    { name: '최민수', email: 'nurse3@hospital.com', skillLevel: 'SENIOR' },
    { name: '정하은', email: 'nurse4@hospital.com', skillLevel: 'SENIOR' },
    { name: '한소영', email: 'nurse5@hospital.com', skillLevel: 'JUNIOR' },
    { name: '강도현', email: 'nurse6@hospital.com', skillLevel: 'JUNIOR' },
    { name: '윤서연', email: 'nurse7@hospital.com', skillLevel: 'SENIOR' },
    { name: '임태호', email: 'nurse8@hospital.com', skillLevel: 'JUNIOR' },
    { name: '송미래', email: 'nurse9@hospital.com', skillLevel: 'SENIOR' },
  ];

  for (const n of nurses) {
    await prisma.nurse.create({
      data: { wardId: ward.id, name: n.name, email: n.email, role: 'NURSE', skillLevel: n.skillLevel, passwordHash: password },
    });
  }

  console.log('시드 데이터 생성 완료');
  console.log(`  병동: ${ward.name} (ID: ${ward.id})`);
  console.log(`  관리자: admin@hospital.com / password123`);
  console.log(`  간호사 ${nurses.length}명 등록`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
