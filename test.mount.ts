  // rustdisk deno import
  const lib = Deno.dlopen("./target/release/librustdisk.so", {
    "get_mounts": { parameters: [], result: "pointer" },
    "free_mounts": { parameters: ["pointer"], result: "void" },
  });
  // get mounts
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

  console.log(mounts.filter(mount => mount.device.includes("/dev")));

  // Free the mounts pointer
  lib.symbols.free_mounts(mountsPtr);
  lib.close();