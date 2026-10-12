/** Shared shape of the event forms: used both to log new events and to edit existing ones. */
export type FormProps<Values> = {
  initial: Values;
  submitLabel?: string;
  onSubmit: (values: Values) => Promise<void>;
};
