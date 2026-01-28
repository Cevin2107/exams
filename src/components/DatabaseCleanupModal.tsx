"use client";

import { useState } from "react";

interface CleanupItem {
  id: string;
  name: string;
  info?: string;
  size?: string;
  assignmentId?: string;
  assignmentTitle?: string;
}

interface CleanupTabProps {
  type: "assignments" | "images" | "questions" | "submissions" | "sessions";
}

export default function DatabaseCleanupModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"assignments" | "images" | "questions" | "submissions" | "sessions">("assignments");
  const [items, setItems] = useState<CleanupItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tabs = [
    { key: "assignments" as const, label: "Bài tập", icon: "📝" },
    { key: "questions" as const, label: "Câu hỏi", icon: "❓" },
    { key: "submissions" as const, label: "Bài nộp", icon: "✅" },
    { key: "sessions" as const, label: "Phiên làm bài", icon: "⏱️" },
    { key: "images" as const, label: "Hình ảnh", icon: "🖼️" },
  ];

  const loadItems = async (type: CleanupTabProps["type"]) => {
    setLoading(true);
    setSelectedItems(new Set());
    try {
      const res = await fetch(`/api/admin/cleanup/${type}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error("Error loading items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: CleanupTabProps["type"]) => {
    setActiveTab(tab);
    loadItems(tab);
  };

  const toggleItem = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const toggleAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  };

  const toggleAssignmentGroup = (groupItems: CleanupItem[]) => {
    const groupIds = groupItems.map((item) => item.id);
    const allSelected = groupIds.every((id) => selectedItems.has(id));
    
    const newSet = new Set(selectedItems);
    if (allSelected) {
      // Deselect all in group
      groupIds.forEach((id) => newSet.delete(id));
    } else {
      // Select all in group
      groupIds.forEach((id) => newSet.add(id));
    }
    setSelectedItems(newSet);
  };

  const handleDelete = async () => {
    if (selectedItems.size === 0) {
      alert("Vui lòng chọn ít nhất một mục để xóa");
      return;
    }

    if (!confirm(`Bạn có chắc muốn xóa ${selectedItems.size} mục đã chọn? Hành động này không thể hoàn tác!`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/cleanup/${activeTab}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedItems) }),
      });

      if (res.ok) {
        alert("Xóa thành công!");
        loadItems(activeTab);
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting items:", error);
      alert("Có lỗi xảy ra khi xóa");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">🗑️ Dọn dẹp Database</h2>
            <p className="text-sm text-slate-600">Xóa các mục không cần thiết để giải phóng dung lượng</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-4 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!loading && items.length === 0 ? (
            <div className="text-center py-12">
              <button
                onClick={() => loadItems(activeTab)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Tải dữ liệu
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <p className="text-slate-600">Đang tải...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select all */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedItems.size === items.length}
                    onChange={toggleAll}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Chọn tất cả ({items.length} mục)
                  </span>
                </label>
                <span className="text-sm text-slate-600">
                  Đã chọn: {selectedItems.size}
                </span>
              </div>

              {/* Items list */}
              {activeTab === "images" ? (
                // Group images by assignment
                (() => {
                  const grouped = items.reduce((acc, item) => {
                    const key = item.assignmentId || "no-assignment";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {} as Record<string, CleanupItem[]>);

                  return Object.entries(grouped).map(([assignmentId, groupItems]) => {
                    const allSelected = groupItems.every((item) => selectedItems.has(item.id));
                    
                    return (
                    <div key={assignmentId} className="mb-4">
                      <div className="sticky top-0 bg-slate-100 border border-slate-300 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggleAssignmentGroup(groupItems)}
                              className="w-4 h-4"
                            />
                            <h3 className="text-sm font-bold text-slate-900">
                              📚 {groupItems[0]?.assignmentTitle || "Không có bài tập"}
                            </h3>
                          </label>
                          <span className="text-xs text-slate-600">{groupItems.length} ảnh</span>
                        </div>
                      </div>
                      <div className="space-y-2 pl-4">
                        {groupItems.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                              selectedItems.has(item.id)
                                ? "border-blue-400 bg-blue-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                              className="w-4 h-4"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">{item.name}</p>
                              {item.info && (
                                <p className="text-xs text-slate-600">{item.info}</p>
                              )}
                            </div>
                            {item.size && (
                              <span className="text-xs text-slate-500">{item.size}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
                })()
              ) : (
                // Regular list for other tabs
                items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                    selectedItems.has(item.id)
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{item.name}</p>
                    {item.info && (
                      <p className="text-xs text-slate-600">{item.info}</p>
                    )}
                  </div>
                  {item.size && (
                    <span className="text-xs text-slate-500">{item.size}</span>
                  )}
                </div>
              )))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {selectedItems.size > 0
              ? `${selectedItems.size} mục được chọn`
              : "Chưa chọn mục nào"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Đóng
            </button>
            <button
              onClick={handleDelete}
              disabled={selectedItems.size === 0 || deleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? "Đang xóa..." : `Xóa ${selectedItems.size > 0 ? `(${selectedItems.size})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
