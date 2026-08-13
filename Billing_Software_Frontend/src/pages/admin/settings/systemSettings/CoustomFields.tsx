import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  X,
  Search,
  Check,
  HelpCircle,
  Eye,
  Sparkles,
  Package,
  Calendar,
  Type,
  Hash,
  CheckSquare,
  Circle,
  DollarSign,
  List,
  Edit,
  AlertCircle,
  Plus,
  MoreVertical,
  Trash2,
  EyeOff,
} from "lucide-react";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import axios from "axios";
import { toast } from "react-toastify";
import SubmitButton from "@components/admin/SubmitButton";

// Type definitions
interface FormData {
  labelName: string;
  dataType: string;
  inputFormat: string;
  helpText: string;
  defaultValue: string;
  isMandatory: string;
  options?: string[];
}

interface CustomField {
  _id: string;
  labelName: string;
  dataType: string;
  inputFormat?: string;
  helpText: string;
  defaultValue: string;
  isMandatory: boolean;
  options: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DataType {
  id: string;
  name: string;
  icon: any;
  color: string;
  bgColor: string;
}

interface InputFormat {
  id: string;
  title: string;
  description: string;
  example: string;
  validation: RegExp;
}

interface CoustomFieldsProps {
  moduleName: string;
}

const CoustomFields: React.FC<CoustomFieldsProps> = ({ moduleName }) => {
  const { token } = useSelector((state: RootState) => state.auth);

  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // State for custom fields list
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [filteredFields, setFilteredFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // State for form data
  const [formData, setFormData] = useState<FormData>({
    labelName: "",
    dataType: "",
    inputFormat: "",
    helpText: "",
    defaultValue: "",
    isMandatory: "No",
    options: [],
  });

  // State for dropdowns
  const [isInputFormatOpen, setIsInputFormatOpen] = useState(false);
  const [isDataTypeOpen, setIsDataTypeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFormats, setFilteredFormats] = useState<InputFormat[]>([]);

  // State for form submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for options management
  const [newOption, setNewOption] = useState("");

  // State for data types
  const [dataTypes, setDataTypes] = useState<DataType[]>([]);

  // State for action dropdown
  const [openActionDropdown, setOpenActionDropdown] = useState<string | null>(null);

  // Refs
  const inputFormatRef = useRef<HTMLDivElement>(null);
  const dataTypeRef = useRef<HTMLDivElement>(null);

  // Input format options
  const inputFormatOptions: InputFormat[] = [
    {
      id: "alphabets-without-spaces",
      title: "Alphabets Without Spaces",
      description:
        "This format ensures that the custom field accepts only a combination of lowercase (a-z) and uppercase (A-Z) letters.",
      example: "Example: 'customfield'",
      validation: /^[a-zA-Z]+$/,
    },
    {
      id: "alphabets-with-spaces",
      title: "Alphabets With Spaces",
      description:
        "This format ensures that the custom field accepts only a combination of lowercase (a-z), uppercase (A-Z) letters, and spaces.",
      example: "Example: 'custom field'",
      validation: /^[a-zA-Z\s]+$/,
    },
    {
      id: "alphanumeric-without-spaces",
      title: "Alphanumeric Characters Without Spaces",
      description:
        "This format ensures that the custom field accepts only a combination of lowercase letters (a-z), uppercase letters (A-Z), and numbers (0-9).",
      example: "Example: 'customfield123'",
      validation: /^[a-zA-Z0-9]+$/,
    },
    {
      id: "alphanumeric-with-spaces",
      title: "Alphanumeric Characters With Spaces",
      description:
        "This format ensures that the custom field accepts only a combination of lowercase letters (a-z), uppercase letters (A-Z), numbers (0-9), and spaces.",
      example: "Example: 'custom field 123'",
      validation: /^[a-zA-Z0-9\s]+$/,
    },
    {
      id: "alphanumeric-with-hyphens",
      title: "Alphanumeric Characters With Hyphens and Underscores",
      description:
        "This format ensures that the custom field accepts only a combination of lowercase letters (a-z), uppercase letters (A-Z), numbers (0-9), hyphens (-), and underscores (_).",
      example: "Example: 'user-name_123'",
      validation: /^[a-zA-Z0-9_-]+$/,
    },
    {
      id: "numbers-only",
      title: "Numbers Only",
      description:
        "This format ensures that the custom field accepts only numeric characters (0-9).",
      example: "Example: '123456'",
      validation: /^[0-9]+$/,
    },
    {
      id: "decimal-numbers",
      title: "Decimal Numbers",
      description:
        "This format ensures that the custom field accepts only decimal numbers with optional decimal point.",
      example: "Example: '123.45'",
      validation: /^[0-9]+(\.[0-9]+)?$/,
    },
    {
      id: "email-format",
      title: "Email Format",
      description:
        "This format ensures that the custom field accepts only valid email addresses.",
      example: "Example: 'user@domain.com'",
      validation: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    },
    {
      id: "phone-format",
      title: "Phone Number Format",
      description:
        "This format ensures that the custom field accepts only phone numbers with optional country code, spaces, hyphens, and parentheses.",
      example: "Example: '+1 (555) 123-4567'",
      validation: /^[\+]?[0-9\s\-\(\)]+$/,
    },
    {
      id: "date-format",
      title: "Date Format",
      description:
        "This format ensures that the custom field accepts only dates in YYYY-MM-DD format.",
      example: "Example: '2024-01-15'",
      validation: /^\d{4}-\d{2}-\d{2}$/,
    },
    {
      id: "no-restrictions",
      title: "No Format Restrictions",
      description:
        "This format allows any characters and has no validation restrictions.",
      example: "Example: 'Any text with special chars!@#$%'",
      validation: /^.*$/,
    },
  ];

  // Icon mapping for data types
  const iconMapping: { [key: string]: any } = {
    text: Type,
    textarea: List,
    number: Hash,
    date: Calendar,
    select: Package,
    checkbox: CheckSquare,
    radio: Circle,
    currency: DollarSign,
  };

  const colorMapping: { [key: string]: { color: string; bgColor: string } } = {
    text: { color: "text-blue-600", bgColor: "bg-blue-50" },
    textarea: { color: "text-primary", bgColor: "bg-third" },
    number: { color: "text-green-600", bgColor: "bg-green-50" },
    date: { color: "text-orange-600", bgColor: "bg-orange-50" },
    select: { color: "text-indigo-600", bgColor: "bg-indigo-50" },
    checkbox: { color: "text-pink-600", bgColor: "bg-pink-50" },
    radio: { color: "text-cyan-600", bgColor: "bg-cyan-50" },
    currency: { color: "text-emerald-600", bgColor: "bg-emerald-50" },
  };

  // Helper function to capitalize module name
  const capitalizeModuleName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // Fetch custom fields
  const fetchCustomFields = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${Constants.FETCH_COUSTOM_FIELDS_URL}?moduleName=${capitalizeModuleName(moduleName)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const fields = response.data.data || [];
      setCustomFields(fields);
      setFilteredFields(fields);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
      toast.error("Failed to fetch custom fields");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data types from API
  const fetchDataTypes = async () => {
    try {
      const response = await axios.get(Constants.FETCH_CUSTOM_FIELDS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Filter only active data types and map to our format
      const apiDataTypes =
        response.data.data?.filter((item: any) => item.isActive) || [];

      const mappedDataTypes = apiDataTypes.map((item: any) => {
        const typeId = item.type;

        return {
          id: typeId,
          name: item.type,
          icon: iconMapping[typeId] || Type,
          color: colorMapping[typeId]?.color || "text-gray-600",
          bgColor: colorMapping[typeId]?.bgColor || "bg-gray-50",
        };
      });

      setDataTypes(mappedDataTypes);
    } catch (error) {
      console.error("Error fetching data types:", error);

      // Fallback to default data types if API fails
      setDataTypes([
        {
          id: "text",
          name: "Text Box (Single Line)",
          icon: Type,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        },
        {
          id: "textarea",
          name: "Text Area",
          icon: List,
          color: "text-primary",
          bgColor: "bg-third",
        },
        {
          id: "number",
          name: "Number",
          icon: Hash,
          color: "text-green-600",
          bgColor: "bg-green-50",
        },
        {
          id: "date",
          name: "Date Picker",
          icon: Calendar,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
        },
        {
          id: "select",
          name: "Select and Option",
          icon: Package,
          color: "text-indigo-600",
          bgColor: "bg-indigo-50",
        },
        {
          id: "checkbox",
          name: "Checkbox",
          icon: CheckSquare,
          color: "text-pink-600",
          bgColor: "bg-pink-50",
        },
        {
          id: "radio",
          name: "Radio Button",
          icon: Circle,
          color: "text-cyan-600",
          bgColor: "bg-cyan-50",
        },
        {
          id: "currency",
          name: "Currency",
          icon: DollarSign,
          color: "text-emerald-600",
          bgColor: "bg-emerald-50",
        },
      ]);
    }
  };

  // Fetch data on component mount and when moduleName changes
  useEffect(() => {
    if (token) {
      fetchCustomFields();
      fetchDataTypes();
    }
  }, [moduleName, token]);

  // Filter formats based on search
  useEffect(() => {
    const filtered = inputFormatOptions.filter(
      (option) =>
        option.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredFormats(filtered);
  }, [searchQuery]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputFormatRef.current &&
        !inputFormatRef.current.contains(event.target as Node)
      ) {
        setIsInputFormatOpen(false);
      }
      if (
        dataTypeRef.current &&
        !dataTypeRef.current.contains(event.target as Node)
      ) {
        setIsDataTypeOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle input format selection
  const handleInputFormatSelect = (format: InputFormat) => {
    setFormData((prev) => ({
      ...prev,
      inputFormat: format.id,
    }));
    setIsInputFormatOpen(false);
    setSearchQuery("");
  };

  // Handle data type selection
  const handleDataTypeSelect = (type: DataType) => {
    setFormData((prev) => ({
      ...prev,
      dataType: type.id,
      options: [], // Reset options when data type changes
    }));
    setIsDataTypeOpen(false);
  };

  // Handle adding option
  const handleAddOption = () => {
    if (newOption.trim() !== "") {
      setFormData((prev) => ({
        ...prev,
        options: [...(prev.options || []), newOption.trim()],
      }));
      setNewOption("");
    }
  };

  // Handle removing option
  const handleRemoveOption = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index) || [],
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate options for select, radio, and checkbox
    if (
      (formData.dataType === "select" ||
        formData.dataType === "radio" ||
        formData.dataType === "checkbox") &&
      (!formData.options || formData.options.length === 0)
    ) {
      toast.error(
        `Please add at least one option for ${formData.dataType} field type`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        labelName: formData.labelName,
        dataType: formData.dataType,
        inputFormat: formData.inputFormat,
        helpText: formData.helpText,
        defaultValue: formData.defaultValue,
        moduleName: capitalizeModuleName(moduleName),
        isMandatory: formData.isMandatory === "Yes",
        ...(formData.options &&
          formData.options.length > 0 && { options: formData.options }),
      };

      if (editingFieldId) {
        // Update existing field
        await axios.put(
          `${Constants.UPDATE_CUSTOM_FIELD_URL}/${editingFieldId}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success("Custom field updated successfully");
      } else {
      // Create new field
      await axios.post(Constants.CREATE_CUSTOM_FIELD_URL, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Custom field created successfully");
      }

      // Reset form
      resetForm();
      setIsModalOpen(false);

      // Refresh the list
      fetchCustomFields();
    } catch (error: any) {
      console.error("Error saving custom field:", error);
      toast.error(
        error.response?.data?.message || "Failed to save custom field"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get selected format details
  const selectedFormat = inputFormatOptions.find(
    (option) => option.id === formData.inputFormat
  );
  const selectedDataType = dataTypes.find(
    (type) => type.id === formData.dataType
  );

  // Get data type display name
  const getDataTypeName = (dataType: string) => {
    const type = dataTypes.find((t) => t.id === dataType);
    return type ? type.name : dataType;
  };

  // Toggle action dropdown
  const toggleActionDropdown = (fieldId: string) => {
    setOpenActionDropdown(openActionDropdown === fieldId ? null : fieldId);
  };

  // Handle edit
  const handleEdit = (field: CustomField) => {
    // Populate form with field data
    setFormData({
      labelName: field.labelName,
      dataType: field.dataType,
      inputFormat: field.inputFormat || "",
      helpText: field.helpText,
      defaultValue: field.defaultValue,
      isMandatory: field.isMandatory ? "Yes" : "No",
      options: field.options || [],
    });
    setEditingFieldId(field._id);
    setIsModalOpen(true);
    setOpenActionDropdown(null);
  };

  // Reset form to create mode
  const resetForm = () => {
      setFormData({
        labelName: "",
        dataType: "",
        inputFormat: "",
        helpText: "",
        defaultValue: "",
        isMandatory: "No",
        options: [],
      });
    setEditingFieldId(null);
      setNewOption("");
  };

  // Handle mark as inactive
  const handleMarkAsInactive = async (fieldId: string) => {
    try {
      await axios.patch(
        `${Constants.FETCH_COUSTOM_FIELDS_URL}/${fieldId}`,
        { isActive: false, moduleName: capitalizeModuleName(moduleName) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Custom field marked as inactive");
      fetchCustomFields();
      setOpenActionDropdown(null);
    } catch (error: any) {
      console.error("Error marking field as inactive:", error);
      toast.error(
        error.response?.data?.message || "Failed to mark field as inactive"
      );
    }
  };

  // Handle delete
  const handleDelete = async (fieldId: string) => {
    if (!window.confirm("Are you sure you want to delete this custom field?")) {
      return;
    }

    try {
      await axios.delete(`${Constants.DELETE_CUSTOM_FIELD_URL}/${fieldId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Custom field deleted successfully");
      fetchCustomFields();
      setOpenActionDropdown(null);
    } catch (error: any) {
      console.error("Error deleting field:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete custom field"
      );
    }
  };

  // Handle opening modal for new field
  const handleNewCustomField = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openActionDropdown) {
        setOpenActionDropdown(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openActionDropdown]);

  // Handle search - client side filtering
  useEffect(() => {
    const filtered = customFields.filter((field) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        field.labelName.toLowerCase().includes(searchLower) ||
        field.dataType.toLowerCase().includes(searchLower) ||
        getDataTypeName(field.dataType).toLowerCase().includes(searchLower)
      );
    });
    setFilteredFields(filtered);
    setCurrentPage(1); // Reset to first page when searching
  }, [searchTerm, customFields]);

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredFields.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredFields.length / itemsPerPage);

  // Handle page change
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {capitalizeModuleName(moduleName)} - Custom Fields
          </h1>
          <button
            onClick={handleNewCustomField}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus size={18} />
            New Custom Field
          </button>
                </div>
              </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <button className="px-6 py-3 text-sm font-semibold text-gray-900 border-b-2 border-gray-900">
                Field Customization
              </button>

              {/* Search Bar */}
              <div className="px-6 py-3">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search by field name or data type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Field Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mandatory
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : filteredFields.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      {searchTerm
                        ? `No custom fields found matching "${searchTerm}"`
                        : "No custom fields found. Click \"New Custom Field\" to create one."}
                    </td>
                  </tr>
                ) : (
                  currentItems.map((field) => (
                    <tr
                      key={field._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <a
                          href="#"
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {field.labelName}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {getDataTypeName(field.dataType)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {field.isMandatory ? "Yes" : "No"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            field.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {field.isActive ? "Active" : "Inactive"}
                </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActionDropdown(field._id);
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <MoreVertical size={18} className="text-gray-600" />
                          </button>

                          {openActionDropdown === field._id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                              <button
                                onClick={() => handleEdit(field)}
                                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors"
                              >
                                <Edit size={16} />
                                Edit
                              </button>
                              {field.isActive && (
                                <button
                                  onClick={() => handleMarkAsInactive(field._id)}
                                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-3 transition-colors"
                                >
                                  <EyeOff size={16} />
                                  Mark as Inactive
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(field._id)}
                                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && filteredFields.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {indexOfFirstItem + 1} to{" "}
                {Math.min(indexOfLastItem, filteredFields.length)} of{" "}
                {filteredFields.length} results
                {searchTerm && ` (filtered from ${customFields.length} total)`}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => {
                        // Show first page, last page, current page, and pages around current
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`px-3 py-1 rounded-md text-sm ${
                                currentPage === page
                                  ? "bg-blue-600 text-white"
                                  : "border border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (
                          page === currentPage - 2 ||
                          page === currentPage + 2
                        ) {
                          return <span key={page} className="px-2">...</span>;
                        }
                        return null;
                      }
                    )}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsModalOpen(false)}
            ></div>

            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full z-50">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg">
                      <Sparkles className="text-white" size={24} />
                  </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {editingFieldId ? "Edit Custom Field" : "Create Custom Field"}
                    </h3>
                </div>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Basic Information */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-3 border-b-2 border-gray-200">
                      <div className="p-1.5 bg-blue-100 rounded-lg">
                        <Package className="text-blue-600" size={18} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Basic Information
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Label Name */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Type size={16} className="text-gray-400" />
                          Label Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="labelName"
                          value={formData.labelName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 bg-gray-50 focus:bg-white"
                          placeholder="Enter the label name"
                          required
                        />
                      </div>

                      {/* Data Type */}
                      <div className="relative" ref={dataTypeRef}>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          Data Type <span className="text-red-500">*</span>
                          <div className="group relative">
                            <HelpCircle
                              size={16}
                              className="text-gray-400 hover:text-blue-600 cursor-help transition-colors"
                            />
                            <div className="invisible group-hover:visible absolute left-0 top-6 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
                              Choose the type of input field
                            </div>
                          </div>
                        </label>
                        <div
                          className="flex items-center justify-between w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white"
                          onClick={() => setIsDataTypeOpen(!isDataTypeOpen)}
                        >
                          <div className="flex items-center gap-3">
                            {selectedDataType && (
                              <div
                                className={`p-1.5 ${selectedDataType.bgColor} rounded-lg`}
                              >
                                <selectedDataType.icon
                                  size={16}
                                  className={selectedDataType.color}
                                />
                              </div>
                            )}
                            <span
                              className={
                                selectedDataType
                                  ? "text-gray-900 font-medium"
                                  : "text-gray-500"
                              }
                            >
                              {selectedDataType
                                ? selectedDataType.name
                                : "Select data type"}
                            </span>
                          </div>
                          <ChevronDown
                            size={18}
                            className={`text-gray-400 transition-transform duration-200 ${
                              isDataTypeOpen ? "rotate-180" : ""
                            }`}
                          />
                        </div>

                        {isDataTypeOpen && (
                          <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto transform transition-all duration-200 ease-in-out opacity-100 translate-y-0">
                            {dataTypes.map((type) => {
                              const Icon = type.icon;
                              return (
                                <div
                                  key={type.id}
                                  className={`p-3.5 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${
                                    formData.dataType === type.id
                                      ? "bg-blue-50 border-blue-500"
                                      : "border-transparent"
                                  }`}
                                  onClick={() => handleDataTypeSelect(type)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`p-2 ${type.bgColor} rounded-lg`}
                                    >
                                      <Icon size={18} className={type.color} />
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-semibold text-gray-900">
                                        {type.name}
                                      </div>
                                    </div>
                                    {formData.dataType === type.id && (
                                      <Check
                                        size={18}
                                        className="text-blue-600"
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                          <AlertCircle size={12} />
                          <span>{dataTypes.length} data types available</span>
                        </div>
                      </div>
                        </div>
                      </div>

                  {/* Field Configuration */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-3 border-b-2 border-gray-200">
                      <div className="p-1.5 bg-third rounded-lg">
                        <Hash className="text-primary" size={18} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Field Configuration
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Default Value */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <Sparkles size={16} className="text-gray-400" />
                          Default Value
                          <span className="text-xs text-gray-500 font-normal">
                            (Optional)
                          </span>
                        </label>
                        {formData.dataType === "date" ? (
                          <input
                            type="date"
                            name="defaultValue"
                            value={formData.defaultValue}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 bg-gray-50 focus:bg-white"
                          />
                        ) : formData.dataType === "number" ||
                          formData.dataType === "currency" ? (
                          <input
                            type="number"
                            name="defaultValue"
                            value={formData.defaultValue}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 bg-gray-50 focus:bg-white"
                            placeholder="Enter a number"
                            step="any"
                          />
                        ) : (
                          <input
                            type="text"
                            name="defaultValue"
                            value={formData.defaultValue}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 bg-gray-50 focus:bg-white"
                            placeholder="Default value"
                          />
                        )}
                      </div>

                      {/* Is Mandatory */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                          <AlertCircle size={16} className="text-gray-400" />
                          Is This Field Required?
                          </label>
                        <div className="flex gap-4">
                          <label className="flex items-center cursor-pointer group/radio">
                            <div className="relative">
                            <input
                                type="radio"
                                name="isMandatory"
                                value="Yes"
                                checked={formData.isMandatory === "Yes"}
                                onChange={handleInputChange}
                                className="peer sr-only"
                              />
                              <div className="w-5 h-5 border-2 border-gray-300 rounded-full peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-all"></div>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100"></div>
                          </div>
                            <span className="ml-3 text-sm font-medium text-gray-700 group-hover/radio:text-gray-900">
                              Yes, Required
                                    </span>
                          </label>
                          <label className="flex items-center cursor-pointer group/radio">
                            <div className="relative">
                              <input
                                type="radio"
                                name="isMandatory"
                                value="No"
                                checked={formData.isMandatory === "No"}
                                onChange={handleInputChange}
                                className="peer sr-only"
                              />
                              <div className="w-5 h-5 border-2 border-gray-300 rounded-full peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-all"></div>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100"></div>
                                  </div>
                            <span className="ml-3 text-sm font-medium text-gray-700 group-hover/radio:text-gray-900">
                              No, Optional
                                </span>
                          </label>
                              </div>
                        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                          <HelpCircle size={12} />
                          Required fields must be filled before submission
                        </p>
                  </div>

                      {/* Help Text */}
                      <div className="md:col-span-2 group">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <HelpCircle size={16} className="text-gray-400" />
                          Help Text
                          <span className="text-xs text-gray-500 font-normal">
                            (Optional)
                          </span>
                        </label>
                        <textarea
                          name="helpText"
                          value={formData.helpText}
                          onChange={handleInputChange}
                          rows={4}
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 bg-gray-50 focus:bg-white resize-none"
                          placeholder="Enter descriptive text to help users understand the purpose and usage of this custom field..."
                        />
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                          <span>
                            This text will appear as a tooltip or help message
                          </span>
                          <span>{formData.helpText.length} characters</span>
                    </div>
                  </div>

                  {/* Input Format */}
                      <div
                        className="md:col-span-2 relative z-50"
                        ref={inputFormatRef}
                      >
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          Input Format
                          <span className="text-xs text-gray-500 font-normal">
                            (Optional)
                          </span>
                          <div className="group relative">
                            <HelpCircle
                              size={16}
                              className="text-gray-400 hover:text-blue-600 cursor-help transition-colors"
                            />
                            <div className="invisible group-hover:visible absolute left-0 top-6 w-56 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
                              Choose a validation pattern for user input
                            </div>
                          </div>
                        </label>
                        <div
                          className="flex items-center justify-between w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white"
                          onClick={() =>
                            setIsInputFormatOpen(!isInputFormatOpen)
                          }
                        >
                          <span
                            className={
                              selectedFormat
                                ? "text-gray-900 font-medium"
                                : "text-gray-500"
                            }
                          >
                            {selectedFormat
                              ? selectedFormat.title
                              : "Select input format"}
                          </span>
                          <div className="flex items-center gap-2">
                            {selectedFormat && (
                              <button
                                type="button"
                                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData((prev) => ({
                                    ...prev,
                                    inputFormat: "",
                                  }));
                                }}
                              >
                                <X
                                  size={16}
                                  className="text-gray-500 hover:text-gray-700"
                                />
                              </button>
                            )}
                            <ChevronDown
                              size={18}
                              className={`text-gray-400 transition-transform duration-200 ${
                                isInputFormatOpen ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {isInputFormatOpen && (
                          <div className="absolute z-[9999] w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-96 overflow-visible transform transition-all duration-200 ease-in-out opacity-100 translate-y-0 top-full">
                            {/* Search Bar */}
                            <div className="p-4 border-b-2 border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
                              <div className="relative">
                                <Search
                                  size={18}
                                  className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400"
                                />
                                <input
                                  type="text"
                                  placeholder="Search validation formats..."
                                  value={searchQuery}
                                  onChange={(e) =>
                                    setSearchQuery(e.target.value)
                                  }
                                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="mt-2 text-xs text-gray-600 flex items-center gap-2">
                                <AlertCircle size={12} />
                                <span>
                                  {filteredFormats.length} format
                                  {filteredFormats.length !== 1 ? "s" : ""}{" "}
                                  available
                                </span>
                              </div>
                            </div>

                            {/* Options List */}
                            <div className="max-h-72 overflow-y-auto">
                              {filteredFormats.length > 0 ? (
                                filteredFormats.map((format) => (
                                  <div
                                    key={format.id}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-all duration-150 border-l-4 ${
                                      formData.inputFormat === format.id
                                        ? "bg-blue-50 border-blue-500"
                                        : "border-transparent"
                                    }`}
                                    onClick={() =>
                                      handleInputFormatSelect(format)
                                    }
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="font-bold text-gray-900">
                                            {format.title}
                                          </div>
                                          {formData.inputFormat ===
                                            format.id && (
                                            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                              Selected
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-sm text-gray-600 leading-relaxed mb-2">
                                          {format.description}
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-mono rounded-lg">
                                          <Eye size={12} />
                                          {format.example}
                                        </div>
                                      </div>
                                      {formData.inputFormat === format.id && (
                                        <Check
                                          size={20}
                                          className="text-blue-600 flex-shrink-0 mt-1"
                                        />
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="p-8 text-center">
                                  <AlertCircle
                                    className="mx-auto mb-3 text-gray-400"
                                    size={40}
                                  />
                                  <p className="text-gray-500 font-medium">
                                    No formats found
                                  </p>
                                  <p className="text-gray-400 text-sm mt-1">
                                    Try a different search term
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {(formData.dataType === "select" ||
                        formData.dataType === "radio" ||
                        formData.dataType === "checkbox") && (
                        <div className="md:col-span-2 group">
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                            <List size={16} className="text-gray-400" />
                            Options <span className="text-red-500">*</span>
                            <span className="text-xs text-gray-500 font-normal">
                              (Add options for{" "}
                              {formData.dataType === "select"
                                ? "dropdown"
                                : formData.dataType}
                              )
                            </span>
                        </label>

                          {/* Add Option Input */}
                          <div className="flex gap-2 mb-3">
                              <input
                              type="text"
                              value={newOption}
                              onChange={(e) => setNewOption(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddOption();
                                }
                              }}
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 bg-gray-50 focus:bg-white"
                              placeholder="Enter option and press Enter or click Add"
                            />
                            <button
                              type="button"
                              onClick={handleAddOption}
                              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold shadow-sm hover:shadow flex items-center gap-2"
                            >
                              <Plus size={18} />
                              Add
                            </button>
                            </div>

                          {/* Options List */}
                          {formData.options && formData.options.length > 0 && (
                            <div className="space-y-2 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                              <p className="text-sm font-semibold text-gray-700 mb-2">
                                Added Options ({formData.options.length}):
                              </p>
                              {formData.options.map((option, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors group"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                                      {index + 1}
                            </span>
                                    <span className="text-gray-900 font-medium">
                                      {option}
                                    </span>
                            </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(index)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remove option"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {(!formData.options ||
                            formData.options.length === 0) && (
                            <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                              <div className="flex items-center gap-2 text-yellow-800 text-sm">
                                <AlertCircle size={16} />
                                <span>
                                  Please add at least one option for this field
                                  type
                            </span>
                        </div>
                      </div>
                          )}
                    </div>
                      )}
                  </div>
                </div>

                {/* Format Description Preview */}
                {selectedFormat && (
                    <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-500 rounded-lg shadow-md">
                        <Eye className="text-white" size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-blue-900">
                            {selectedFormat.title}
                          </h4>
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                            Active
                          </span>
                        </div>
                        <p className="text-sm text-blue-800 mb-3 leading-relaxed">
                          {selectedFormat.description}
                        </p>
                        <div className="inline-flex items-center gap-2 px-3 py-2 bg-white/80 border border-blue-300 rounded-lg">
                          <span className="text-xs font-semibold text-blue-900">
                            Example:
                          </span>
                          <code className="text-xs font-mono text-blue-700 font-semibold">
                            {selectedFormat.example.replace("Example: ", "")}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        resetForm();
                      }}
                      className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  <SubmitButton
                    isLoading={isSubmitting}
                      mode={editingFieldId ? "edit" : "create"}
                  >
                      {editingFieldId ? "Update Field" : "Create Field"}
                  </SubmitButton>
                </div>
              </form>
            </div>
          </div>
                    </div>
                  </div>
      )}
    </div>
  );
};

export default CoustomFields;
