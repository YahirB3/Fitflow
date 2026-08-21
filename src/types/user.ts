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
