/** 平台自适应检测 */

/** 是否为移动端 */
export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent)
    || ('ontouchstart' in window && window.innerWidth < 1024);
}

/** 是否为 PC 端 */
export function isPC(): boolean {
  return !isMobile();
}

/** 获取平台类型 */
export function getPlatform(): 'pc' | 'mobile' {
  return isMobile() ? 'mobile' : 'pc';
}

/** 获取合适的缩放比例 */
export function getScale(): number {
  return isMobile() ? 1 : 2;
}