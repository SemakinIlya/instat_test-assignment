export function validateDraft(draft: {
  name: string;
  email: string;
  phone: string;
  deliveryMethod: 'pickup' | 'courier';
  city: string;
  street: string;
  house: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.name.trim().length < 2) errors.name = 'Укажите имя — не меньше двух символов.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    errors.email = 'Укажите email в формате name@example.test.';
  }
  if (!/^\+[1-9]\d{9,14}$/.test(draft.phone.trim())) {
    errors.phone = 'Телефон: «+» и 10–15 цифр, например +79990000000.';
  }
  if (draft.deliveryMethod === 'courier') {
    if (draft.city.trim().length < 2) errors.city = 'Укажите город.';
    if (draft.street.trim().length < 2) errors.street = 'Укажите улицу.';
    if (draft.house.trim().length < 1) errors.house = 'Укажите дом.';
  }
  return errors;
}
