/** 신규 회원가입만 검사한다. 기존 계정의 로그인에는 적용하지 않는다. */
export function registrationIssue(
  user: string,
  password: string,
): string | null {
  if ((!user || /[^a-z0-9]/.test(user)) || user.length > 40) {
    return "아이디는 영문 소문자와 숫자만 사용할 수 있습니다(최대 40자).";
  }
  if (
    password.length > 128 ||
    (!password || /[^\x21-\x7e]/.test(password))
  ) {
    return "비밀번호는 공백 없이 ASCII 문자만 사용할 수 있습니다(최대 128자).";
  }
  return null;
}
