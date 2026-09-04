import type { BusinessDimension } from "@/lib/dashboard-data";

export const bizTabs: { id: BusinessDimension; label: string }[] = [
  { id: "phase", label: "Phase" },
  { id: "region", label: "Location" },
  { id: "channel", label: "Channel" },
  { id: "buying_type", label: "Buying Type" },
];

export const demoTabs: { id: "age" | "gender" | "region"; label: string }[] = [
  { id: "age", label: "Độ tuổi" },
  { id: "gender", label: "Giới tính" },
  { id: "region", label: "Khu vực" },
];

// Lưu ý: chưa thấy chỗ nào dùng platformDemoTabs trong code gốc — giữ lại để
// không mất tính năng nếu có nơi khác đang tham chiếu, nhưng có thể là dead
// code, em kiểm tra lại nếu muốn dọn bớt.
export const platformDemoTabs: { id: "age" | "gender" | "region" | "device"; label: string }[] = [
  { id: "age", label: "Độ tuổi" },
  { id: "gender", label: "Giới tính" },
  { id: "region", label: "Khu vực" },
  { id: "device", label: "Thiết bị" },
];