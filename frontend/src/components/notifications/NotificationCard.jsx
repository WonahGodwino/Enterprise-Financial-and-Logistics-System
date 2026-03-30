import React, { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
} from 'lucide-react';
import { formatNotification } from '../../utils/notificationFormatter';

const ICON_MAP = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

/**
 * NotificationCard - User-friendly notification display component
 * Formats and displays transaction logs and notification events
 */
const NotificationCard = ({
  notification,
  onMarkAsRead,
  onDelete,
  isRead = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!notification) return null;

  const formatted = formatNotification(notification);
  const {
    id,
    formattedType,
    formattedMessage,
    formattedTime,
    metadata,
    severity,
    colors,
  } = formatted;

  const IconComponent = ICON_MAP[severity] || Info;
  const hasMetadata = metadata && metadata.length > 0;
  const hasRecipients = notification.recipients && notification.recipients.length > 0;

  return (
    <div
      className={`rounded-lg border transition-all ${colors.border} ${
        isRead ? colors.bg : 'bg-white shadow-md'
      }`}
    >
      {/* Main Header */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 mt-1">
            <IconComponent className={`h-5 w-5 ${colors.icon}`} />
          </div>

          {/* Content */}
          <div className="flex-grow min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-grow">
                {/* Type Badge */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${colors.badge}`}
                  >
                    {formattedType}
                  </span>
                  {!isRead && (
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                  )}
                </div>

                {/* Message */}
                <p className={`text-sm font-medium ${colors.text} mb-2`}>
                  {formattedMessage}
                </p>

                {/* Time */}
                <p className="text-xs text-gray-500">{formattedTime}</p>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {!isRead && onMarkAsRead && (
                  <button
                    onClick={() => onMarkAsRead(id)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}

                {hasMetadata && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title={isExpanded ? 'Hide details' : 'Show details'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                )}

                {onDelete && (
                  <button
                    onClick={() => onDelete(id)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metadata Section (Expandable) */}
        {hasMetadata && isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {metadata.map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    {label}
                  </p>
                  <p className="text-sm text-gray-700 break-words">{value}</p>
                </div>
              ))}
            </div>

            {/* Recipients Section */}
            {hasRecipients && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Recipients
                </p>
                <div className="space-y-2">
                  {notification.recipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <div className="h-2 w-2 rounded-full bg-gray-300" />
                      <span>
                        {recipient.fullName}
                        {recipient.role && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({recipient.role})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCard;
