export interface File {
  id: string;
  project_id: string;
  name: string;
  path: string;
  parent_id: string | null;
  is_folder: boolean;
  created_at: string;
  updated_at: string;
}
