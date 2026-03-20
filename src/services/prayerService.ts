import { Coordinates, CalculationMethod, PrayerTimes, SunnahTimes, Qibla, Madhab } from 'adhan';
import { format } from 'date-fns';

export interface PrayerTime {
  name: string;
  time: string;
  isNext: boolean;
}

export function getPrayerTimes(lat: number, lng: number, method: string = 'MuslimWorldLeague', madhab: string = 'Shafi'): PrayerTime[] {
  const coords = new Coordinates(lat, lng);
  const date = new Date();
  const params = CalculationMethod[method as keyof typeof CalculationMethod]();
  if (madhab === 'Hanafi') {
    params.madhab = Madhab.Hanafi;
  }

  const prayerTimes = new PrayerTimes(coords, date, params);
  const nextPrayer = prayerTimes.nextPrayer();

  const times = [
    { name: 'Fajr', time: prayerTimes.fajr },
    { name: 'Sunrise', time: prayerTimes.sunrise },
    { name: 'Dhuhr', time: prayerTimes.dhuhr },
    { name: 'Asr', time: prayerTimes.asr },
    { name: 'Maghrib', time: prayerTimes.maghrib },
    { name: 'Isha', time: prayerTimes.isha },
  ];

  return times.map(t => ({
    name: t.name,
    time: format(t.time, 'hh:mm a'),
    isNext: t.name.toLowerCase() === nextPrayer,
  }));
}

export function getQiblaDirection(lat: number, lng: number): number {
  const coords = new Coordinates(lat, lng);
  return Qibla(coords);
}
