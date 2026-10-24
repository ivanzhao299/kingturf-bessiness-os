export const formatBusinessDate = (date: Date): string => date.toLocaleDateString('zh-CN');

export const formatBusinessDateTime = (date: Date): string => date.toLocaleString('zh-CN');

// Construct at the call site before its Date argument, exactly like the original heading.
export const businessHeadingDateFormatter = (): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
