// 실제 화면과 반응형 미리보기에서 같은 대화 입력 레이아웃을 사용한다.
export function ChatPanel({title, messages, value, disabled, onChange, onSubmit}: {
  title: string; messages: {id: string; name: string; text: string}[];
  value: string; disabled: boolean; onChange: (value: string) => void; onSubmit: () => void;
}) {
  return <section class="card chat">
    <h3>{title}</h3>
    <div class="chat-lines" aria-live="polite">
      {messages.map(message => <p key={message.id}><b>{message.name}</b> {message.text}</p>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      <input aria-label="채팅 메시지" maxLength={200} value={value} enterKeyHint="send"
        onInput={event => onChange(event.currentTarget.value)} placeholder="함께하는 모험가에게" />
      <button disabled={disabled || !value.trim()}>전송</button>
    </form>
  </section>;
}
