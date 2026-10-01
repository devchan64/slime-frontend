import {parseCityTaxResponse} from '../src/client/city-tax-validation.mjs';
const CITY_TAX_DATE_FORMATTER=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export async function readCurrentCityTaxes(currentTextClient,currentCommandArguments){
 if(currentCommandArguments.length)throw new Error('taxes로 도시 세율을 조회하세요.');
 const currentTaxResponse=parseCityTaxResponse(await currentTextClient.request('/v1/economy/city-taxes'));
 const currentStartText=CITY_TAX_DATE_FORMATTER.format(currentTaxResponse.startsAt*1000);
 const currentExpiryText=CITY_TAX_DATE_FORMATTER.format(currentTaxResponse.expiresAt*1000);
 return `도시 세율 · 정책 v${currentTaxResponse.policyVersion}\n적용 기간(KST): ${currentStartText} ~ ${currentExpiryText} 미만\n`+
  currentTaxResponse.entries.map(currentCityEntry=>`${currentCityEntry.cityName.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ')} [${currentCityEntry.cityId}]: ${currentCityEntry.taxBasisPoints/100}% · 유효 유료 시민권 ${currentCityEntry.paidCitizenshipCount}개`).join('\n')+
  '\n확정 세율 조회입니다. 실제 거래 견적·정산 연결은 아직 적용 전입니다.';
}
