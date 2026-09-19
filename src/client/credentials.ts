/** 신규 회원가입만 검사한다. 기존 계정의 로그인에는 적용하지 않는다. */
export function registrationIssue(
  user: string,
  password: string,
): string | null {
  if ((!user || /[^a-z0-9]/.test(user)) || user.length > 40) {
    return "auth.invalidUsername";
  }
  if (
    password.length > 128 ||
    (!password || /[^\x21-\x7e]/.test(password))
  ) {
    return "auth.invalidPassword";
  }
  return null;
}
