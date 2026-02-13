export interface ClassInfo {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  studentNo: string;
  classId: string;
  className: string;
  cardNo: number | null;
}

export interface Question {
  id: string;
  title: string;
  type: "single" | "truefalse";
  options: string[];
  correctAnswer: number;
  category: string;
  createdAt: string;
}

export interface AnswerStat {
  questionId: string;
  questionTitle: string;
  totalResponses: number;
  correctCount: number;
  optionCounts: number[];
}

export const mockClasses: ClassInfo[] = [
  { id: "1", name: "高三(1)班", grade: "高三", studentCount: 65, createdAt: "2024-09-01" },
  { id: "2", name: "高三(2)班", grade: "高三", studentCount: 68, createdAt: "2024-09-01" },
  { id: "3", name: "高二(1)班", grade: "高二", studentCount: 60, createdAt: "2024-09-01" },
  { id: "4", name: "高一(3)班", grade: "高一", studentCount: 70, createdAt: "2024-09-02" },
];

export const mockStudents: Student[] = Array.from({ length: 70 }, (_, i) => ({
  id: `s${i + 1}`,
  name: `学生${String(i + 1).padStart(2, "0")}`,
  studentNo: `2024${String(i + 1).padStart(3, "0")}`,
  classId: "1",
  className: "高三(1)班",
  cardNo: i + 1,
}));

export const mockQuestions: Question[] = [
  {
    id: "q1", title: "下列哪个是地球的卫星？", type: "single",
    options: ["月球", "太阳", "火星", "金星"], correctAnswer: 0,
    category: "地理", createdAt: "2024-10-01",
  },
  {
    id: "q2", title: "水的化学式是H2O", type: "truefalse",
    options: ["正确", "错误"], correctAnswer: 0,
    category: "化学", createdAt: "2024-10-02",
  },
  {
    id: "q3", title: "光合作用发生在细胞的哪个结构中？", type: "single",
    options: ["线粒体", "叶绿体", "细胞核", "高尔基体"], correctAnswer: 1,
    category: "生物", createdAt: "2024-10-03",
  },
  {
    id: "q4", title: "以下哪个朝代最早？", type: "single",
    options: ["唐朝", "汉朝", "宋朝", "明朝"], correctAnswer: 1,
    category: "历史", createdAt: "2024-10-04",
  },
  {
    id: "q5", title: "1+1=2 是数学公理", type: "truefalse",
    options: ["正确", "错误"], correctAnswer: 0,
    category: "数学", createdAt: "2024-10-05",
  },
];

export const mockAnswerStats: AnswerStat[] = [
  { questionId: "q1", questionTitle: "下列哪个是地球的卫星？", totalResponses: 65, correctCount: 58, optionCounts: [58, 2, 3, 2] },
  { questionId: "q3", questionTitle: "光合作用发生在细胞的哪个结构中？", totalResponses: 65, correctCount: 45, optionCounts: [12, 45, 5, 3] },
  { questionId: "q4", questionTitle: "以下哪个朝代最早？", totalResponses: 65, correctCount: 52, optionCounts: [8, 52, 3, 2] },
];
