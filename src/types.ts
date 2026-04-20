export interface Task {
  id: string;
  name: string;
  color: string;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
}

export interface Property {
  id: string;        // e.g. "P-001"
  name: string;
  createdAt: string; // ISO timestamp
  assigneeId: string | null;
  tasks: Task[];
}

export interface TaskTemplate {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
}

export interface Member {
  id: string;
  name: string;
}
