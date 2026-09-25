export interface MockIrmContact {
  name: string;
  status: 'Available' | 'Busy' | 'Offline';
}

export const MOCK_IRMS: MockIrmContact[] = [
  { name: 'Ananya Iyer', status: 'Available' },
  { name: 'Rohan Mehta', status: 'Busy' },
  { name: 'Priya Nair', status: 'Available' },
];
