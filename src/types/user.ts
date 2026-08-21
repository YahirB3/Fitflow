export type UserRole = 'user' | 'trainer' | 'admin';

export type AssignmentStatus = 'pending' | 'active' | 'rejected' | 'ended';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  goals?: string[];
  equipment?: string[];
  createdAt: string;
  updatedAt: string;
};

export type TrainerAssignment = {
  id: string;
  trainerId: string;
  clientId: string;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
};

export type RoutineAssignmentStatus = 'active' | 'replaced' | 'completed';

export type RoutineOwnerRole = 'user' | 'trainer';

export type RoutineAssignment = {
  id: string;
  routineId: string;
  templateId?: string;
  trainerId: string;
  clientId: string;
  title: string;
  routine: import('./workout').RoutineDay[];
  status: RoutineAssignmentStatus;
  assignedAt: string;
  updatedAt: string;
};

export type RoutineTemplate = {
  id: string;
  ownerId: string;
  ownerRole: RoutineOwnerRole;
  title: string;
  routine: import('./workout').RoutineDay[];
  createdAt: string;
  updatedAt: string;
};
