import { CollectionDocVersion } from '../extension-db/DB';

export function reduceDays(
  versions: CollectionDocVersion[] | undefined,
  minAgeDays = 3
): CollectionDocVersion[] {
  const versionsByDay: Record<string, CollectionDocVersion[]> = {};

  const minDate = new Date();
  minDate.setDate(minDate.getDate() - minAgeDays);

  // put all versions from the same day in the same array
  versions?.forEach((version) => {
    const date = version.timestamp || new Date('2020-06-04');
    date.setUTCHours(0, 0, 0, 0);
    const day = date.toISOString().substring(0, 10);

    if (!versionsByDay[day]) {
      versionsByDay[day] = [];
    }

    versionsByDay[day]?.push(version);
  });

  // go through each day and
  // reduce each day's versions into a single version
  return Object.entries(versionsByDay).flatMap(
    ([day, versions]): CollectionDocVersion | CollectionDocVersion[] => {
      // only reduce if min age is less than
      if (new Date(day) > minDate) return versions || [];

      // reduce each day to single version
      return (versions || []).reduce((previousValue, currentValue): CollectionDocVersion => {
        return {
          state: currentValue.state,
          timestamp: currentValue.timestamp || new Date('2020-06-04'),
          users: [...previousValue.users, ...currentValue.users].filter((elem, index, self) => {
            return self.findIndex((t) => t.name === elem.name) === index;
          }),
        };
      });
    }
  );
}
