export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;  // optional message to be returned to the client
}
