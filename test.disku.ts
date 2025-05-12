  const lib = Deno.dlopen("./target/release/librustdisk.so", {
    "get_disk_usage": { parameters: ["pointer"], result: "pointer" },
    "free_disk_usage": { parameters: ["pointer"], result: "void" },
    "get_mounts": { parameters: [], result: "pointer" },
    "free_mounts": { parameters: ["pointer"], result: "void" },
  });

  const diskpath = "/"
  const pathBuffer = new TextEncoder().encode(diskpath + "\0"); // null-terminated string
  const pathPointer = Deno.UnsafePointer.of(pathBuffer); // pointer to the string
  const usagePtr = lib.symbols.get_disk_usage(pathPointer); // pointer to DiskUsage struct
  if (usagePtr === null) throw new Error("Failed to get disk usage"); // check for null pointer
  const usageView = new Deno.UnsafePointerView(usagePtr); // create a view of the pointer
  const total = usageView.getBigUint64(0); // total size
  const free = usageView.getBigUint64(8); // free size
  const used = usageView.getBigUint64(16); // used size
  lib.symbols.free_disk_usage(usagePtr); // free the pointer

  console.log(`Disk usage for ${diskpath}:`); 
  console.log(`Total: ${total}`);
  console.log(`Free: ${free}`);
  console.log(`Used: ${used}`);