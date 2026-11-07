/** 仅允许服务端声明的已物理清理前缀形成 seq 跳跃；中间缺页仍拒绝推进水位。 */
export function hgIMPageAfter(hgList, hgAfter, hgFloor) {
  if (!Number.isSafeInteger(hgFloor) || hgFloor < 0) throw new Error("历史起点协议不合法");
  let hgExpected = hgAfter; // 已呈现的连续水位；首条可从已清理前缀末尾恢复。
  for (let hgIndex = 0; hgIndex < hgList.length; hgIndex++) {
    const hgSeq = hgList[hgIndex].seq; // 本页消息序号，必须是非零安全整数。
    if (!Number.isSafeInteger(hgSeq) || hgSeq <= 0 ||
      (hgSeq !== hgExpected + 1 && !(hgIndex === 0 && hgExpected < hgFloor && hgSeq === hgFloor)))
      throw new Error("消息序号不连续，请重新同步");
    hgExpected = hgSeq;
  }
  return hgExpected;
}
