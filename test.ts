try {
  const lib = Deno.dlopen("./target/release/librustdisk.so", {
    "get_disk_usage": { parameters: ["pointer"], result: "pointer" },
    "free_disk_usage": { parameters: ["pointer"], result: "void" },
    "get_mounts": { parameters: [], result: "pointer" },
    "free_mounts": { parameters: ["pointer"], result: "void" },
  });
  
  const mountsPtr = lib.symbols.get_mounts();
  if (mountsPtr === null) throw new Error("get_mounts() returned null");

  const view = new Deno.UnsafePointerView(mountsPtr);
  const mountsPtrInner = view.getPointer(0); // MountInfo *
  const length = view.getBigUint64(8); // usize

  const mounts = [];

  for (let i = 0n; i < length; i++) {
    const offset = Number(i) * 16; // size of MountInfo struct (two pointers)
    const mountView = new Deno.UnsafePointerView(mountsPtrInner!);
    const devicePtr = mountView.getPointer(offset);
    const mountPointPtr = mountView.getPointer(offset + 8);
    const device = new Deno.UnsafePointerView(devicePtr!).getCString();
    const mountPoint = new Deno.UnsafePointerView(mountPointPtr!).getCString();
    mounts.push({ device, mountPoint });
  }

  console.log(mounts.filter(mount => mount.device.includes("/dev")).map(mount => {
    const pathBuffer = new TextEncoder().encode(mount.mountPoint + "\0");
    const pathPointer = Deno.UnsafePointer.of(pathBuffer);
    const usagePtr = lib.symbols.get_disk_usage(pathPointer);
    if (usagePtr === null) {
      throw new Error("Failed to get disk usage");
    }
    const usageView = new Deno.UnsafePointerView(usagePtr);
    const total = usageView.getBigUint64(0);
    const free = usageView.getBigUint64(8);
    const used = usageView.getBigUint64(16);
    lib.symbols.free_disk_usage(usagePtr);
    return {
      device: mount.device,
      mountPoint: mount.mountPoint,
      total: formatBytes(Number(total)),
      free: formatBytes(Number(free)),
      used: formatBytes(Number(used)),
      percentage: ((Number(used) / Number(total)) * 100).toFixed(2) + "%",
    }
  }));

  lib.symbols.free_mounts(mountsPtr);
  lib.close();

} catch (error) {
  console.error("Error loading library or calling function:", error);
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(decimals)} ${sizes[i]}`;
}