export type User = {
  id: string;

  name: string;

  password_hash: string;
};

export type Invite = {
  id: string;

  uses: number | null;
};

export type Audio = {
  id: string;

  uploader_id: User["id"] | null;

  time_uploaded: number;

  file_name: string;

  processing: 0 | 1;

  /*
   * 0 - extract metadata
   * 1 - error
   * 2 - extract thumbnail
   * 3 - transcode
   */
  processing_state: 0 | 1 | 2 | 3;

  has_thumbnail: 0 | 1;

  duration: number | null;

  size: number | null;

  tags: string | null;
};
