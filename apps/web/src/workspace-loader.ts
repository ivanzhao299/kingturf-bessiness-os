/** Keep business JS and CSS out of the unauthenticated critical path. */
type WorkspaceModule = Pick<typeof import('./bootstrap'), 'mountWorkspace'>;

export async function loadWorkspace(
  importer: () => Promise<WorkspaceModule> = () => import('./bootstrap'),
): Promise<WorkspaceModule> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      importer(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('业务工作台下载超时'));
        }, 45_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
