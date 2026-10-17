import { notifyDbChanged, onDbChanged } from './db-changes';

describe('notifyDbChanged', () => {
  it('tells every listener which tables changed, until it is removed', () => {
    const first = jest.fn();
    const second = jest.fn();
    const a = onDbChanged(first);
    const b = onDbChanged(second);

    notifyDbChanged(['event']);
    expect(first).toHaveBeenCalledWith(['event']);
    expect(second).toHaveBeenCalledWith(['event']);

    a.remove();
    notifyDbChanged(['child']);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenLastCalledWith(['child']);
    b.remove();
  });
});
