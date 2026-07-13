import { Profile, Settings, User } from './types';

// Repository interfaces. Feature/route code depends ONLY on these — never on a
// concrete JSON or Postgres implementation. This is what makes the datastore swappable.

export interface UserRepo {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: User): Promise<User>;
}

export interface ProfileRepo {
  get(userId: string): Promise<Profile | null>;
  upsert(profile: Profile): Promise<Profile>;
}

export interface SettingsRepo {
  get(userId: string): Promise<Settings | null>;
  upsert(settings: Settings): Promise<Settings>;
}

export interface DataLayer {
  users: UserRepo;
  profiles: ProfileRepo;
  settings: SettingsRepo;
  // Called once at boot. JSON impl ensures the file exists; Postgres connects.
  init(): Promise<void>;
}
