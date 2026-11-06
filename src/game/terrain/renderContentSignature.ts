/** HTTP·실시간 전송의 객체 키 순서와 무관하게 렌더링 내용을 비교한다. 배열 순서는 보존한다. */
export function createRenderContentSignature(currentContentValue: unknown): string {
  return JSON.stringify(currentContentValue, (_currentPropertyName, currentPropertyValue) => {
    if (currentPropertyValue === null || typeof currentPropertyValue !== 'object' || Array.isArray(currentPropertyValue)) return currentPropertyValue;
    return Object.fromEntries(Object.keys(currentPropertyValue).sort().map(currentPropertyKey => [currentPropertyKey, currentPropertyValue[currentPropertyKey]]));
  });
}
