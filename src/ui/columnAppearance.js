const TONES = ["word", "translation", "sentence", "example", "note"];

export function columnTone(tag, role, index = 0) {
  const name = String(tag || "").trim().toLowerCase();
  if (/translation|translate|meaning|bedeutung|翻译/.test(name)) return "translation";
  if (/word|vocab|wort|单词/.test(name)) return "word";
  if (/example|beispiel/.test(name)) return "example";
  if (/note|notiz/.test(name)) return "note";
  if (/sentence|satz/.test(name)) return "sentence";
  if (TONES.includes(role)) return role;
  return TONES[index % TONES.length];
}
