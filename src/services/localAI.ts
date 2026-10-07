/**
 * Local AI boundary. No cloud calls are made here.
 * A native on-device model can be connected behind these functions later
 * (for example, a bundled vision/embedding model or a platform ML runtime).
 */
export type Face = { id: string; name: string; confidence: number };

export async function describePhoto(_uri: string) {
  return 'Local AI description will be generated on-device.';
}

export async function recognizeFaces(_uri: string): Promise<Face[]> {
  return [];
}

export async function createTaskFromText(text: string) {
  return { title: text.trim(), dueDate: null as Date | null };
}
