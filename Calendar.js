const moment = require('moment');
const fs = require('fs');

class Processor {
  #daySlots = {};
  #calendarDataSource;
  constructor(calendarDataSource) {
    if (this.constructor == Processor) {
      throw new Error('Must instantiate the class;');
    }
    this.#calendarDataSource = calendarDataSource;
  }

  getAvailableSpots(calendarDataSource) {
    throw new Error('Must implement available spots method');
  }

  __getMomentHour(dateISO, hour) {
    return moment(dateISO + ' ' + hour);
  }

  __addMinutes(hour, minutes) {
    return moment(hour).add(minutes, 'minutes').format('HH:mm');
  }

  __getOneMiniSlot(
    slotMetaData = {
      startSlot: null,
      endSlot: null,
      duration: null,
      dateISO: null,
    },
  ) {
    const { durationBefore, durationAfter } =
      this.#calendarDataSource.getData();

    const { startSlot, endSlot, duration, dateISO } = slotMetaData;

    const startHourFirst = this.__getMomentHour(dateISO, startSlot);

    const startHour = startHourFirst.format('HH:mm');
    const endHour = this.__addMinutes(
      startHourFirst,
      durationBefore + duration + durationAfter,
    );
    const clientStartHour = this.__addMinutes(startHourFirst, durationBefore);
    const clientEndHour = this.__addMinutes(startHourFirst, duration);

    if (
      moment.utc(endHour, 'HH:mm').valueOf() >
      moment.utc(endSlot, 'HH:mm').valueOf()
    ) {
      return null;
    }
    const objSlot = {
      startHour: moment.utc(dateISO + ' ' + startHour).toDate(),
      endHour: moment.utc(dateISO + ' ' + endHour).toDate(),
      clientStartHour: moment.utc(dateISO + ' ' + clientStartHour).toDate(),
      clientEndHour: moment.utc(dateISO + ' ' + clientEndHour).toDate(),
    };
    return objSlot;
  }

  __getDaySlots(date) {
    if (!date) return [];
    if (date in this.#daySlots) return this.#daySlots[date];
    const data = this.#calendarDataSource.getData();
    this.#daySlots[date] = data.slots[date] || [];
    return this.#daySlots[date];
  }

  __getRealSlots(daySlots, dateISO, date) {
    const data = this.#calendarDataSource.getData();

    if (!(data.sessions || data.sessions[date])) return [];
    const realSpots = daySlots.reduce((acc, daySlot) => {
      let noConflicts = true;
      const slots = data.sessions[date].map((sessionSlot) => {
        const sessionStart = moment(
          dateISO + ' ' + sessionSlot.start,
        ).valueOf();
        const sessionEnd = moment(dateISO + ' ' + sessionSlot.end).valueOf();
        const start = moment(dateISO + ' ' + daySlot.start).valueOf();
        const end = moment(dateISO + ' ' + daySlot.end).valueOf();
        if (sessionStart > start && sessionEnd < end) {
          noConflicts = false;
          return [
            {
              start: daySlot.start,
              end: sessionSlot.start,
            },
            {
              start: sessionSlot.end,
              end: daySlot.end,
            },
          ];
        } else if (sessionStart === start && sessionEnd < end) {
          noConflicts = false;
          return {
            start: sessionSlot.end,
            end: daySlot.end,
          };
        } else if (sessionStart > start && sessionEnd === end) {
          noConflicts = false;
          return {
            start: daySlot.start,
            end: sessionSlot.start,
          };
        } else if (sessionStart === start && sessionEnd === end) {
          noConflicts = false;
          return [];
        }
        return [];
      });
      if (noConflicts) {
        acc = [...acc, daySlot];
      }
      acc = [...acc, ...slots.flatMap((v) => v)];
      return acc;
    }, []);

    return realSpots;
  }

  __prepareResultSlots(realSpots=[], dateISO, duration) {
    let arrSlot = [];
    realSpots.forEach(function (slot) {
      let start = slot.start;
      let resultSlot;
      do {
        resultSlot = this.__getOneMiniSlot({
          startSlot: start,
          endSlot: slot.end,
          duration,
          dateISO,
        });
        if (resultSlot) {
          arrSlot.push(resultSlot);
          start = moment.utc(resultSlot.endHour).format('HH:mm');
        }
      } while (resultSlot);

      return arrSlot;
    }, this);
    return arrSlot;
  }
  __getSlots(date, duration) {
    const dateISO = moment(date, 'DD-MM-YYYY').format('YYYY-MM-DD');
    const daySlots = this.__getDaySlots(date);
    const realSpots = this.__getRealSlots(daySlots, dateISO, date);
    return this.__prepareResultSlots(realSpots, dateISO, duration);
  }

  getAvailableSpots(date, duration) {
    return this.__getSlots(date, duration);
  }
}

class DefaultProcessor extends Processor {
  constructor(calendarDataSource) {
    super(calendarDataSource);
    if (!calendarDataSource || !(calendarDataSource instanceof CalendarData)) {
      throw new Error('Invalid data source');
    }
  }
}

class CalendarData {
  constructor() {
    if (this.constructor == CalendarData) {
      throw new Error('Must instantiate the class;');
    }
  }

  __build() {
    throw new Error('Must implement build method');
  }

  getData() {
    throw new Error('Must implement the getData method');
  }
}

class DefaultCalendarData extends CalendarData {
  #pathFile;
  #data;
  constructor($pathFile) {
    super();
    this.#pathFile = $pathFile;
    this.__build();
  }

  __build() {
    const rawdata = fs.readFileSync(
      './calendars/calendar.' + this.#pathFile + '.json',
    );
    this.#data = JSON.parse(rawdata);
  }

  getData() {
    return this.#data;
  }
}

class Calendar {
  #processor;
  constructor(processor) {
    this.#processor = processor;
    if (!processor || !(processor instanceof Processor))
      throw new Error('Invalid processor');
  }

  getAvailability(date, duration) {
    return this.#processor.getAvailableSpots(date, duration);
  }
}

module.exports = { Calendar, DefaultCalendarData, DefaultProcessor };
